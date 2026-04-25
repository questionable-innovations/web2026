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

    address[] public allEscrows;
    mapping(address => address[]) public escrowsByParty;

    event EscrowCreated(
        address indexed escrow, address indexed partyA, IERC20 indexed token, uint256 amount
    );

    constructor(address _implementation) {
        implementation = _implementation;
    }

    /// @notice Deploy a new Escrow clone and initialize it atomically.
    /// @param token Deposit token (e.g. dNZD). Immutable on the clone.
    /// @param amount Deposit amount in token's smallest unit.
    /// @param pdfHash sha256 of the PDF bytes pinned to IPFS.
    /// @param pdfCid IPFS CID of the (optionally encrypted) PDF.
    /// @param dealDeadline Contract end-date used for `rescue` arithmetic.
    /// @param validUntil URL-link expiry; after this, countersign reverts.
    /// @param secretHash keccak256(secret) — the URL fragment is `#<secret>`.
    /// @param partyAAttestation EIP-712 typed-data attestation from partyA.
    /// @param partyASignature 65-byte ECDSA signature over the attestation.
    function createEscrow(
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
        escrow = Clones.clone(implementation);
        _init(
            escrow,
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
    }

    /// @notice Deterministic counterpart used by the web client: Party A predicts
    /// the clone address with `predictAddress(salt)`, EIP-712-signs an attestation
    /// bound to that address, then submits the tx. Avoids the chicken-and-egg of
    /// "the domain separator depends on the address that doesn't exist yet."
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
        _init(
            escrow,
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
    }

    function _init(
        address escrow,
        IERC20 token,
        uint256 amount,
        bytes32 pdfHash,
        string calldata pdfCid,
        uint64 dealDeadline,
        uint64 validUntil,
        bytes32 secretHash,
        Escrow.Attestation calldata partyAAttestation,
        bytes calldata partyASignature
    ) internal {
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
        allEscrows.push(escrow);
        escrowsByParty[msg.sender].push(escrow);
        emit EscrowCreated(escrow, msg.sender, token, amount);
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
