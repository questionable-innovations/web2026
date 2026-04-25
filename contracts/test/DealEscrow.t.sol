// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "./utils/Test.sol";
import {DealEscrow} from "../src/DealEscrow.sol";
import {DealFactory} from "../src/DealFactory.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract DealEscrowTest is Test {
    address internal constant PAYER = address(0xA11CE);
    address internal constant PAYEE = address(0xB0B);
    address internal constant STRANGER = address(0xCAFE);

    uint256 internal constant DEAL_AMOUNT = 1_000e6;
    bytes32 internal constant PDF_HASH = keccak256("pdf");
    bytes32 internal constant SECRET = keccak256("dealseal-secret-raw");
    bytes32 internal constant SECRET_HASH = keccak256(abi.encodePacked(SECRET));
    bytes32 internal constant PAYER_IDENTITY_HASH = keccak256("payer-id");
    bytes32 internal constant PAYEE_IDENTITY_HASH = keccak256("payee-id");

    MockERC20 internal token;
    DealEscrow internal implementation;
    DealFactory internal factory;
    DealEscrow internal deal;

    function setUp() public {
        token = new MockERC20("Demo NZD", "dNZD", 6);
        implementation = new DealEscrow();
        factory = new DealFactory(address(implementation));

        token.mint(PAYER, DEAL_AMOUNT * 10);

        deal = DealEscrow(
            factory.createDeal(
                DealFactory.CreateDealParams({
                    payer: PAYER,
                    payee: PAYEE,
                    settlementToken: address(token),
                    amount: DEAL_AMOUNT,
                    pdfHash: PDF_HASH,
                    secretHash: SECRET_HASH,
                    payerIdentityHash: PAYER_IDENTITY_HASH,
                    payeeIdentityHash: PAYEE_IDENTITY_HASH
                })
            )
        );
    }

    function testCreateDealInitializesClone() public {
        assertEq(deal.factory(), address(factory));
        assertEq(deal.payer(), PAYER);
        assertEq(deal.payee(), PAYEE);
        assertEq(address(deal.settlementToken()), address(token));
        assertEq(deal.amount(), DEAL_AMOUNT);
        assertEq(deal.pdfHash(), PDF_HASH);
        assertEq(deal.secretHash(), SECRET_HASH);
        assertEq(uint256(deal.status()), uint256(DealEscrow.Status.Draft));
    }

    function testPayerCanSignAndFund() public {
        vm.startPrank(PAYER);
        token.approve(address(deal), DEAL_AMOUNT);
        deal.signAndFund(keccak256("payer-signature"));
        vm.stopPrank();

        assertEq(token.balanceOf(address(deal)), DEAL_AMOUNT);
        assertEq(uint256(deal.status()), uint256(DealEscrow.Status.Funded));
    }

    function testPayeeCountersignMovesDealActive() public {
        vm.startPrank(PAYER);
        token.approve(address(deal), DEAL_AMOUNT);
        deal.signAndFund(keccak256("payer-signature"));
        vm.stopPrank();

        vm.prank(PAYEE);
        deal.countersign(SECRET, keccak256("payee-signature"));

        assertEq(uint256(deal.status()), uint256(DealEscrow.Status.Active));
        assertTrue(deal.isFullySigned());
    }

    function testWrongSecretReverts() public {
        vm.startPrank(PAYER);
        token.approve(address(deal), DEAL_AMOUNT);
        deal.signAndFund(keccak256("payer-signature"));
        vm.stopPrank();

        vm.prank(PAYEE);
        vm.expectRevert(DealEscrow.InvalidSecret.selector);
        deal.countersign(bytes32(uint256(123)), keccak256("payee-signature"));
    }

    function testOnlyPayerCanFund() public {
        vm.prank(STRANGER);
        vm.expectRevert(DealEscrow.Unauthorized.selector);
        deal.signAndFund(keccak256("bad"));
    }

    function testOnlyPayeeCanCountersign() public {
        vm.startPrank(PAYER);
        token.approve(address(deal), DEAL_AMOUNT);
        deal.signAndFund(keccak256("payer-signature"));
        vm.stopPrank();

        vm.prank(STRANGER);
        vm.expectRevert(DealEscrow.Unauthorized.selector);
        deal.countersign(SECRET, keccak256("bad"));
    }

    function testReleaseFlowPaysPayee() public {
        _activateDeal();

        vm.prank(PAYEE);
        deal.requestRelease();

        assertEq(uint256(deal.status()), uint256(DealEscrow.Status.ReleaseRequested));

        vm.prank(PAYER);
        deal.approveRelease();

        assertEq(token.balanceOf(PAYEE), DEAL_AMOUNT);
        assertEq(token.balanceOf(address(deal)), 0);
        assertEq(uint256(deal.status()), uint256(DealEscrow.Status.Released));
    }

    function testRefundFlowPaysPayerBack() public {
        _activateDeal();

        uint256 payerBalanceBefore = token.balanceOf(PAYER);

        vm.prank(PAYER);
        deal.requestRefund();

        vm.prank(PAYEE);
        deal.approveRefund();

        assertEq(token.balanceOf(PAYER), payerBalanceBefore + DEAL_AMOUNT);
        assertEq(token.balanceOf(address(deal)), 0);
        assertEq(uint256(deal.status()), uint256(DealEscrow.Status.Refunded));
    }

    function testDisputeFreezesReleaseFlow() public {
        _activateDeal();

        vm.prank(PAYEE);
        deal.flagDispute();

        assertEq(uint256(deal.status()), uint256(DealEscrow.Status.Disputed));

        vm.prank(PAYEE);
        vm.expectRevert(DealEscrow.DealDisputed.selector);
        deal.requestRelease();
    }

    function testCannotReinitializeClone() public {
        vm.expectRevert(DealEscrow.AlreadyInitialized.selector);
        deal.initialize(
            address(factory),
            PAYER,
            PAYEE,
            address(token),
            DEAL_AMOUNT,
            PDF_HASH,
            SECRET_HASH,
            PAYER_IDENTITY_HASH,
            PAYEE_IDENTITY_HASH
        );
    }

    function _activateDeal() internal {
        vm.startPrank(PAYER);
        token.approve(address(deal), DEAL_AMOUNT);
        deal.signAndFund(keccak256("payer-signature"));
        vm.stopPrank();

        vm.prank(PAYEE);
        deal.countersign(SECRET, keccak256("payee-signature"));
    }
}
