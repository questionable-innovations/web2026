// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Clones} from "./libraries/Clones.sol";
import {DealEscrow} from "./DealEscrow.sol";

contract DealFactory {
    using Clones for address;

    error InvalidImplementation();

    address public immutable implementation;
    uint256 public totalDeals;

    event DealCreated(
        address indexed deal,
        address indexed creator,
        address indexed payer,
        address payee,
        address settlementToken,
        uint256 amount,
        bytes32 pdfHash,
        bytes32 secretHash,
        uint256 dealId
    );

    struct CreateDealParams {
        address payer;
        address payee;
        address settlementToken;
        uint256 amount;
        bytes32 pdfHash;
        bytes32 secretHash;
        bytes32 payerIdentityHash;
        bytes32 payeeIdentityHash;
    }

    constructor(address implementation_) {
        if (implementation_ == address(0)) revert InvalidImplementation();
        implementation = implementation_;
    }

    function createDeal(CreateDealParams calldata params) external returns (address deal) {
        deal = implementation.clone();
        DealEscrow(deal).initialize(
            address(this),
            params.payer,
            params.payee,
            params.settlementToken,
            params.amount,
            params.pdfHash,
            params.secretHash,
            params.payerIdentityHash,
            params.payeeIdentityHash
        );

        unchecked {
            ++totalDeals;
        }

        emit DealCreated(
            deal,
            msg.sender,
            params.payer,
            params.payee,
            params.settlementToken,
            params.amount,
            params.pdfHash,
            params.secretHash,
            totalDeals
        );
    }
}
