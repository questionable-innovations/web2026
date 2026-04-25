// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";
import {SafeTransferLib} from "./libraries/SafeTransferLib.sol";

contract DealEscrow {
    using SafeTransferLib for IERC20;

    enum Status {
        Uninitialized,
        Draft,
        Funded,
        Active,
        ReleaseRequested,
        RefundRequested,
        Released,
        Refunded,
        Disputed
    }

    error AlreadyInitialized();
    error Unauthorized();
    error InvalidStatus(Status expected, Status actual);
    error InvalidAddress();
    error InvalidAmount();
    error InvalidSecret();
    error AlreadySigned();
    error DealDisputed();

    event DealInitialized(
        address indexed factory,
        address indexed payer,
        address indexed payee,
        address settlementToken,
        uint256 amount,
        bytes32 pdfHash,
        bytes32 secretHash
    );
    event Signed(address indexed signer, bytes32 indexed signerDigest, uint256 signedAt, Status nextStatus);
    event Funded(address indexed payer, uint256 amount, uint256 fundedAt);
    event ReleaseRequested(address indexed requester, uint256 requestedAt);
    event RefundRequested(address indexed requester, uint256 requestedAt);
    event DealReleased(address indexed approver, address indexed recipient, uint256 amount, uint256 releasedAt);
    event DealRefunded(address indexed approver, address indexed recipient, uint256 amount, uint256 refundedAt);
    event DealDisputed(address indexed caller, uint256 disputedAt);

    address public factory;
    address public payer;
    address public payee;
    IERC20 public settlementToken;
    uint256 public amount;
    bytes32 public pdfHash;
    bytes32 public secretHash;
    bytes32 public payerIdentityHash;
    bytes32 public payeeIdentityHash;

    uint64 public createdAt;
    uint64 public fundedAt;
    uint64 public payerSignedAt;
    uint64 public payeeSignedAt;
    uint64 public releaseRequestedAt;
    uint64 public refundRequestedAt;
    uint64 public releasedAt;
    uint64 public refundedAt;
    uint64 public disputedAt;

    address public releaseRequestedBy;
    address public refundRequestedBy;
    Status public status;

    function initialize(
        address factory_,
        address payer_,
        address payee_,
        address settlementToken_,
        uint256 amount_,
        bytes32 pdfHash_,
        bytes32 secretHash_,
        bytes32 payerIdentityHash_,
        bytes32 payeeIdentityHash_
    ) external {
        if (status != Status.Uninitialized) revert AlreadyInitialized();
        if (
            factory_ == address(0) || payer_ == address(0) || payee_ == address(0)
                || settlementToken_ == address(0)
        ) {
            revert InvalidAddress();
        }
        if (payer_ == payee_) revert InvalidAddress();
        if (amount_ == 0) revert InvalidAmount();

        factory = factory_;
        payer = payer_;
        payee = payee_;
        settlementToken = IERC20(settlementToken_);
        amount = amount_;
        pdfHash = pdfHash_;
        secretHash = secretHash_;
        payerIdentityHash = payerIdentityHash_;
        payeeIdentityHash = payeeIdentityHash_;
        createdAt = uint64(block.timestamp);
        status = Status.Draft;

        emit DealInitialized(factory_, payer_, payee_, settlementToken_, amount_, pdfHash_, secretHash_);
    }

    function signAndFund(bytes32 signerDigest) external {
        if (msg.sender != payer) revert Unauthorized();
        if (status != Status.Draft) revert InvalidStatus(Status.Draft, status);
        if (payerSignedAt != 0) revert AlreadySigned();

        settlementToken.safeTransferFrom(msg.sender, address(this), amount);

        fundedAt = uint64(block.timestamp);
        payerSignedAt = uint64(block.timestamp);
        status = Status.Funded;

        emit Funded(msg.sender, amount, fundedAt);
        emit Signed(msg.sender, signerDigest, payerSignedAt, status);
    }

    function countersign(bytes32 secret, bytes32 signerDigest) external {
        if (msg.sender != payee) revert Unauthorized();
        if (status != Status.Funded) revert InvalidStatus(Status.Funded, status);
        if (payeeSignedAt != 0) revert AlreadySigned();
        if (keccak256(abi.encodePacked(secret)) != secretHash) revert InvalidSecret();

        payeeSignedAt = uint64(block.timestamp);
        status = Status.Active;

        emit Signed(msg.sender, signerDigest, payeeSignedAt, status);
    }

    function requestRelease() external {
        if (status == Status.Disputed) revert DealDisputed();
        if (msg.sender != payee) revert Unauthorized();
        if (status != Status.Active) revert InvalidStatus(Status.Active, status);

        releaseRequestedBy = msg.sender;
        releaseRequestedAt = uint64(block.timestamp);
        status = Status.ReleaseRequested;

        emit ReleaseRequested(msg.sender, releaseRequestedAt);
    }

    function approveRelease() external {
        if (status == Status.Disputed) revert DealDisputed();
        if (msg.sender != payer) revert Unauthorized();
        if (status != Status.ReleaseRequested) revert InvalidStatus(Status.ReleaseRequested, status);
        if (releaseRequestedBy != payee) revert Unauthorized();

        status = Status.Released;
        releasedAt = uint64(block.timestamp);
        settlementToken.safeTransfer(payee, amount);

        emit DealReleased(msg.sender, payee, amount, releasedAt);
    }

    function requestRefund() external {
        if (status == Status.Disputed) revert DealDisputed();
        if (msg.sender != payer) revert Unauthorized();
        if (status != Status.Active) revert InvalidStatus(Status.Active, status);

        refundRequestedBy = msg.sender;
        refundRequestedAt = uint64(block.timestamp);
        status = Status.RefundRequested;

        emit RefundRequested(msg.sender, refundRequestedAt);
    }

    function approveRefund() external {
        if (status == Status.Disputed) revert DealDisputed();
        if (msg.sender != payee) revert Unauthorized();
        if (status != Status.RefundRequested) revert InvalidStatus(Status.RefundRequested, status);
        if (refundRequestedBy != payer) revert Unauthorized();

        status = Status.Refunded;
        refundedAt = uint64(block.timestamp);
        settlementToken.safeTransfer(payer, amount);

        emit DealRefunded(msg.sender, payer, amount, refundedAt);
    }

    function flagDispute() external {
        if (msg.sender != payer && msg.sender != payee) revert Unauthorized();
        if (isTerminal()) revert InvalidStatus(Status.Active, status);
        if (status == Status.Uninitialized || status == Status.Draft) revert InvalidStatus(Status.Active, status);

        status = Status.Disputed;
        disputedAt = uint64(block.timestamp);

        emit DealDisputed(msg.sender, disputedAt);
    }

    function isFullySigned() external view returns (bool) {
        return payerSignedAt != 0 && payeeSignedAt != 0;
    }

    function isTerminal() public view returns (bool) {
        return status == Status.Released || status == Status.Refunded || status == Status.Disputed;
    }
}
