// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Escrow} from "./Escrow.sol";

/// @title EscrowFactory — deploys EIP-1167 minimal-proxy clones of Escrow.
/// @notice ~45k gas per deal vs ~1.5M for full deploys (§4.2).
/// @dev v1 is intentionally non-upgradeable. The §4.2 roadmap calls for UUPS
///      behind a 2-of-3 timelocked multisig; that affects only *future* clones.
contract EscrowFactory {
    address public immutable implementation;
    address public platformWallet;
    address public aavePool;

    address[] public allEscrows;
    mapping(address => address[]) public escrowsByParty;
    mapping(address => bool) public isEscrow;

    event EscrowCreated(
        address indexed escrow, address indexed partyA, IERC20 indexed token, uint256 amount
    );
    event EscrowCountersigned(address indexed escrow, address indexed partyB);

    error NotEscrow();

    constructor(address _implementation, address _platformWallet, address _aavePool) {
        implementation = _implementation;
        platformWallet = _platformWallet;
        aavePool = _aavePool;
    }

    /// @notice Deploy a new Escrow clone and initialize it atomically.
    /// @dev Deterministic by design: the EIP-712 domain separator depends on
    ///      the verifying contract address, so partyA needs to predict the
    ///      clone address (`predictAddress(salt)`) before signing the
    ///      attestation. A non-deterministic counterpart is omitted because
    ///      it would force the signature to be produced *after* deployment,
    ///      which doesn't match the one-tx flow.
    /// @param salt Random 32 bytes; client-side `crypto.getRandomValues`.
    /// @param token Deposit token (e.g. dNZD). Immutable on the clone.
    /// @param amount Deposit amount in token's smallest unit.
    /// @param pdfHash sha256 of the PDF bytes pinned to IPFS.
    /// @param pdfCid IPFS CID of the (optionally encrypted) PDF.
    /// @param dealDeadline Contract end-date used for `rescue` arithmetic.
    /// @param validUntil URL-link expiry; after this, countersign reverts.
    /// @param secretHash keccak256(secret) — the URL fragment is `#<secret>`.
    /// @param partyAAttestation EIP-712 typed-data attestation from partyA.
    /// @param partyASignature ECDSA signature (or EIP-1271 sig for smart wallets).
    function createEscrowDeterministic(
        bytes32 salt,
        IERC20 token,
        uint256 amount,
        bytes32 pdfHash,
        string calldata pdfCid,
        uint64 dealDeadline,
        uint64 validUntil,
        bytes32 secretHash,
        Escrow.Attestation calldata partyAAttestation,
        bytes calldata partyASignature
    ) external returns (address escrow) {
        escrow = Clones.cloneDeterministic(implementation, salt);
        isEscrow[escrow] = true;
        allEscrows.push(escrow);
        escrowsByParty[msg.sender].push(escrow);

        Escrow(escrow).initialize(
            msg.sender,
            token,
            amount,
            pdfHash,
            pdfCid,
            dealDeadline,
            validUntil,
            secretHash,
            partyAAttestation,
            partyASignature
        );
        emit EscrowCreated(escrow, msg.sender, token, amount);
    }

    /// @notice Called by an Escrow clone when partyB countersigns, so the
    ///         reputation aggregator can index deals against both sides.
    ///         Auth'd by `isEscrow[msg.sender]` — only clones we deployed
    ///         can write into our index.
    function recordCountersign(address partyB) external {
        if (!isEscrow[msg.sender]) revert NotEscrow();
        escrowsByParty[partyB].push(msg.sender);
        emit EscrowCountersigned(msg.sender, partyB);
    }

    function escrowCount() external view returns (uint256) {
        return allEscrows.length;
    }

    function partyEscrowCount(address party) external view returns (uint256) {
        return escrowsByParty[party].length;
    }

    function predictAddress(bytes32 salt) external view returns (address) {
        return Clones.predictDeterministicAddress(implementation, salt, address(this));
    }
}
