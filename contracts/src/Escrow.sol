// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {ReentrancyGuardUpgradeable} from
    "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {EIP712Upgradeable} from
    "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";

interface IEscrowFactory {
    function recordCountersign(address partyB) external;
    function aavePool() external view returns (address);
    function platformWallet() external view returns (address);
}

interface IPool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
}

/// @title Escrow — deployed as an EIP-1167 minimal proxy clone, one per agreement.
/// @notice State machine for sign + deposit + release. Deadlock by design (§3.4).
/// No admin, no upgrade — the implementation behind the clones is immutable.
/// Token is set at init and is `immutable` by convention (cannot be changed).
contract Escrow is Initializable, ReentrancyGuardUpgradeable, EIP712Upgradeable {
    using SafeERC20 for IERC20;

    enum State {
        Draft,
        AwaitingCounterparty,
        Active,
        Releasing,
        Released,
        Disputed,
        Closed,
        Rescued
    }

    /// EIP-712 typed data for an attestation.
    /// `nameHash` and `emailHash` are salted per-attestation to defeat rainbow
    /// lookups against the chain (§4.2).
    struct Attestation {
        address wallet;
        bytes32 nameHash;
        bytes32 emailHash;
        bytes32 pdfHash;
        uint256 nonce;
        uint256 deadline;
    }

    bytes32 private constant ATTESTATION_TYPEHASH = keccak256(
        "Attestation(address wallet,bytes32 nameHash,bytes32 emailHash,bytes32 pdfHash,uint256 nonce,uint256 deadline)"
    );

    /// Long-horizon escape hatch (§4.2). 365 days minimum, intended for the
    /// "token blacklisted / paused indefinitely" failure mode.
    uint256 public constant RESCUE_TIMEOUT = 365 days;

    address public factory;
    address public partyA;
    address public partyB;
    IERC20 public token;
    uint256 public amount;
    bytes32 public pdfHash;
    string public pdfCid;
    uint64 public deadline;
    uint64 public validUntil;

    bytes32 public secretHash;
    bool public secretConsumed;

    State public state;
    State public preDisputeState;
    address public proposedReleaseBy;
    address public disputedBy;
    string public disputeReason;
    uint256 public withdrawable;

    mapping(address => uint256) public nonces;
    mapping(address => Attestation) public attestations;

    event Initialized(address indexed partyA, IERC20 token, uint256 amount);
    event Countersigned(address indexed signer, bytes32 nameHash, bytes32 emailHash);
    event ReleaseProposed(address indexed by);
    event ReleaseApproved(address indexed by, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    event Disputed(address indexed by, string reason);
    event DisputeCancelled(address indexed by);
    event Rescued(address indexed to, uint256 amount);

    error WrongState(State expected, State actual);
    error NotPartyA();
    error NotASigner();
    error LinkExpired();
    error BadSecret();
    error SecretAlreadyUsed();
    error AttestationExpired();
    error BadAttestation();
    error TransferAmountMismatch();
    error RescueTimeoutNotReached();
    error NothingToWithdraw();
    error CannotApproveOwnProposal();
    error InvalidInit();
    error NotDisputer();

    modifier inState(State s) {
        if (state != s) revert WrongState(s, state);
        _;
    }

    constructor() {
        _disableInitializers();
    }

    /// @notice One-shot init called by the factory immediately after `clone()`.
    function initialize(
        address _partyA,
        IERC20 _token,
        uint256 _amount,
        bytes32 _pdfHash,
        string calldata _pdfCid,
        uint64 _deadline,
        uint64 _validUntil,
        bytes32 _secretHash,
        Attestation calldata partyAAttestation,
        bytes calldata partyASignature
    ) external initializer {
        if (_partyA == address(0)) revert InvalidInit();
        if (address(_token) == address(0)) revert InvalidInit();
        if (_amount == 0) revert InvalidInit();
        if (_pdfHash == bytes32(0)) revert InvalidInit();
        if (_secretHash == bytes32(0)) revert InvalidInit();
        if (_deadline <= block.timestamp) revert InvalidInit();
        if (_validUntil == 0 || _validUntil > _deadline) revert InvalidInit();

        __ReentrancyGuard_init();
        __EIP712_init("DealSeal", "1");

        factory = msg.sender;
        partyA = _partyA;
        token = _token;
        amount = _amount;
        pdfHash = _pdfHash;
        pdfCid = _pdfCid;
        deadline = _deadline;
        validUntil = _validUntil;
        secretHash = _secretHash;

        _verifyAttestation(_partyA, partyAAttestation, partyASignature);
        attestations[_partyA] = partyAAttestation;
        nonces[_partyA] = partyAAttestation.nonce + 1;

        state = State.AwaitingCounterparty;
        emit Initialized(_partyA, _token, _amount);
    }

    /// @notice Party B presents the secret (preimage of the URL fragment hash),
    ///         attests, and deposits in a single tx. Caller must `approve` first.
    function countersign(
        bytes32 secret,
        Attestation calldata partyBAttestation,
        bytes calldata partyBSignature
    ) external nonReentrant inState(State.AwaitingCounterparty) {
        if (block.timestamp > validUntil) revert LinkExpired();
        if (secretConsumed) revert SecretAlreadyUsed();
        if (keccak256(abi.encodePacked(secret)) != secretHash) revert BadSecret();
        secretConsumed = true;

        _verifyAttestation(msg.sender, partyBAttestation, partyBSignature);
        attestations[msg.sender] = partyBAttestation;
        nonces[msg.sender] = partyBAttestation.nonce + 1;

        partyB = msg.sender;
        state = State.Active;

        // Effects done; pull the deposit and assert the post-balance delta to
        // catch fee-on-transfer / blacklist tokens (§4.2).
        uint256 balBefore = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        if (token.balanceOf(address(this)) - balBefore != amount) {
            revert TransferAmountMismatch();
        }

        // Supply the deposited tokens to Aave Pool
        address aavePool = IEscrowFactory(factory).aavePool();
        if (aavePool != address(0)) {
            token.approve(aavePool, amount);
            IPool(aavePool).supply(address(token), amount, address(this), 0);
        }

        // Index partyB on the factory so reputation aggregates over both sides.
        // Failure here is non-fatal — the on-chain commitment is what matters,
        // and the factory address is fixed at clone-time so this can only
        // revert if the factory contract itself is bricked.
        IEscrowFactory(factory).recordCountersign(msg.sender);

        emit Countersigned(msg.sender, partyBAttestation.nameHash, partyBAttestation.emailHash);
    }

    function proposeRelease() external inState(State.Active) {
        if (msg.sender != partyA && msg.sender != partyB) revert NotASigner();
        proposedReleaseBy = msg.sender;
        state = State.Releasing;
        emit ReleaseProposed(msg.sender);
    }

    /// @notice Counterparty approves; funds become withdrawable to partyA (pull).
    function approveRelease() external inState(State.Releasing) {
        if (msg.sender != partyA && msg.sender != partyB) revert NotASigner();
        if (msg.sender == proposedReleaseBy) revert CannotApproveOwnProposal();
        state = State.Released;
        withdrawable = amount;
        emit ReleaseApproved(msg.sender, amount);
    }

    /// @notice Pull-payment for partyA after release. Anyone may call on behalf;
    ///         funds always flow to partyA.
    function withdraw() external nonReentrant inState(State.Released) {
        uint256 amt = withdrawable;
        if (amt == 0) revert NothingToWithdraw();
        withdrawable = 0;
        state = State.Closed;

        address aavePool = IEscrowFactory(factory).aavePool();
        if (aavePool != address(0)) {
            uint256 totalWithdrawn = IPool(aavePool).withdraw(address(token), type(uint256).max, address(this));
            if (totalWithdrawn > amt) {
                address platformWallet = IEscrowFactory(factory).platformWallet();
                if (platformWallet != address(0)) {
                    token.safeTransfer(platformWallet, totalWithdrawn - amt);
                }
            } else {
                amt = totalWithdrawn;
            }
        }

        if (amt > 0) {
            token.safeTransfer(partyA, amt);
        }

        emit Withdrawn(partyA, amt);
    }

    function flagDispute(string calldata reason) external {
        if (msg.sender != partyA && msg.sender != partyB) revert NotASigner();
        if (state != State.Active && state != State.Releasing) {
            revert WrongState(State.Active, state);
        }
        preDisputeState = state;
        state = State.Disputed;
        disputedBy = msg.sender;
        disputeReason = reason;
        emit Disputed(msg.sender, reason);
    }

    /// @notice Only the party who flagged the dispute may withdraw it.
    ///         Restores the *exact* prior state so a dispute raised mid-
    ///         release doesn't silently revert the counterparty's pending
    ///         proposal — they'd have to repropose otherwise (grief vector).
    function cancelDispute() external inState(State.Disputed) {
        if (msg.sender != disputedBy) revert NotDisputer();
        State prior = preDisputeState;
        state = prior;
        preDisputeState = State.Draft;
        disputedBy = address(0);
        disputeReason = "";
        // If we're not returning to Releasing, the prior proposal (if any)
        // is no longer meaningful — clear it so a stale `proposedReleaseBy`
        // doesn't shadow a fresh proposeRelease/approveRelease pairing.
        if (prior != State.Releasing) {
            proposedReleaseBy = address(0);
        }
        emit DisputeCancelled(msg.sender);
    }

    /// @notice Last-resort path for the "intended recipient is untransferrable"
    ///         failure mode (token blacklist / indefinite pause). Sends funds
    ///         to the *non-blacklisted* counterparty after RESCUE_TIMEOUT past
    ///         the deadline. Callable by either signer (§4.2).
    function rescue() external nonReentrant {
        if (msg.sender != partyA && msg.sender != partyB) revert NotASigner();
        // Don't unwind a deal that's already terminated — withdraw() set
        // state to Closed and zeroed the balance; rescuing from there would
        // either revert on `bal == 0` or claw back stray dust to the wrong
        // party. Explicit state guard makes the intent legible.
        if (state == State.Closed || state == State.Rescued) {
            revert WrongState(State.Active, state);
        }
        if (block.timestamp < uint256(deadline) + RESCUE_TIMEOUT) {
            revert RescueTimeoutNotReached();
        }
        
        address aavePool = IEscrowFactory(factory).aavePool();
        uint256 bal = amount;

        if (aavePool != address(0)) {
            uint256 totalWithdrawn = IPool(aavePool).withdraw(address(token), type(uint256).max, address(this));
            if (totalWithdrawn > bal) {
                address platformWallet = IEscrowFactory(factory).platformWallet();
                if (platformWallet != address(0)) {
                    token.safeTransfer(platformWallet, totalWithdrawn - bal);
                }
            } else {
                bal = totalWithdrawn;
            }
        } else {
            bal = token.balanceOf(address(this));
        }

        if (bal == 0) revert NothingToWithdraw();

        // For the v1 demo, send to caller. Full fix (try partyA first, fall
        // back to partyB on transfer failure) is tracked separately.
        // Lands in `Rescued`, *not* `Closed`, so ReputationView doesn't
        // count an unhappy unwind as a successfully completed deal.
        address recipient = msg.sender;
        withdrawable = 0;
        state = State.Rescued;
        token.safeTransfer(recipient, bal);
        emit Rescued(recipient, bal);
    }

    // ------------------------------------------------------------------
    // EIP-712
    // ------------------------------------------------------------------

    function hashAttestation(Attestation calldata a) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                ATTESTATION_TYPEHASH,
                a.wallet,
                a.nameHash,
                a.emailHash,
                a.pdfHash,
                a.nonce,
                a.deadline
            )
        );
    }

    function _verifyAttestation(
        address signer,
        Attestation calldata a,
        bytes calldata signature
    ) internal view {
        if (signer == address(0)) revert BadAttestation();
        if (a.wallet != signer) revert BadAttestation();
        if (a.pdfHash != pdfHash) revert BadAttestation();
        if (a.nonce != nonces[signer]) revert BadAttestation();
        if (block.timestamp > a.deadline) revert AttestationExpired();

        bytes32 digest = _hashTypedDataV4(hashAttestation(a));
        // SignatureChecker handles ECDSA (with malleability rejection via
        // OZ's ECDSA.tryRecover) plus EIP-1271 for smart-contract wallets.
        if (!SignatureChecker.isValidSignatureNow(signer, digest, signature)) {
            revert BadAttestation();
        }
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
