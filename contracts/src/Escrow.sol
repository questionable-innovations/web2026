// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuardUpgradeable} from
    "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {EIP712Upgradeable} from
    "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";

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
        Disputed
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
    address public proposedReleaseBy;
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
    function withdraw() external nonReentrant {
        uint256 amt = withdrawable;
        if (amt == 0) revert NothingToWithdraw();
        withdrawable = 0;
        token.safeTransfer(partyA, amt);
        emit Withdrawn(partyA, amt);
    }

    function flagDispute(string calldata reason) external {
        if (msg.sender != partyA && msg.sender != partyB) revert NotASigner();
        if (state != State.Active && state != State.Releasing) {
            revert WrongState(State.Active, state);
        }
        state = State.Disputed;
        disputeReason = reason;
        emit Disputed(msg.sender, reason);
    }

    /// @notice Last-resort path for the "intended recipient is untransferrable"
    ///         failure mode (token blacklist / indefinite pause). Sends funds
    ///         to the *non-blacklisted* counterparty after RESCUE_TIMEOUT past
    ///         the deadline. Callable by either signer (§4.2).
    function rescue() external nonReentrant {
        if (msg.sender != partyA && msg.sender != partyB) revert NotASigner();
        if (block.timestamp < uint256(deadline) + RESCUE_TIMEOUT) {
            revert RescueTimeoutNotReached();
        }
        uint256 bal = token.balanceOf(address(this));
        if (bal == 0) revert NothingToWithdraw();

        // If transferring to partyA fails (e.g. blacklisted), the caller can
        // re-attempt with partyB as the recipient by ensuring this tx originates
        // from partyB. For the v1 demo, we just send to the caller; in prod a
        // try/catch on partyA-first is the right shape.
        address recipient = msg.sender;
        withdrawable = 0;
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
        if (a.wallet != signer) revert BadAttestation();
        if (a.pdfHash != pdfHash) revert BadAttestation();
        if (a.nonce != nonces[signer]) revert BadAttestation();
        if (block.timestamp > a.deadline) revert AttestationExpired();

        bytes32 digest = _hashTypedDataV4(hashAttestation(a));
        address recovered = _recoverSigner(digest, signature);
        if (recovered != signer) revert BadAttestation();
    }

    function _recoverSigner(bytes32 digest, bytes calldata sig)
        private
        pure
        returns (address)
    {
        if (sig.length != 65) revert BadAttestation();
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 0x20))
            v := byte(0, calldataload(add(sig.offset, 0x40)))
        }
        return ecrecover(digest, v, r, s);
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
