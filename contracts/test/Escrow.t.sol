// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test, Vm} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {EscrowFactory} from "../src/EscrowFactory.sol";
import {Escrow} from "../src/Escrow.sol";

contract MockToken is ERC20 {
    constructor() ERC20("Mock dNZD", "dNZD") {
        _mint(msg.sender, 1_000_000 ether);
    }
}

contract EscrowTest is Test {
    EscrowFactory factory;
    Escrow impl;
    MockToken token;

    Vm.Wallet alice;
    Vm.Wallet bob;
    bytes32 constant SECRET = keccak256("super-secret-url-fragment");

    function setUp() public {
        impl = new Escrow();
        // Aave integration disabled in unit tests: all three Aave-related
        // addresses zero. The factory enforces that they move together.
        factory = new EscrowFactory(address(impl), address(0), address(0), address(0));
        token = new MockToken();
        alice = vm.createWallet("alice");
        bob = vm.createWallet("bob");
        token.transfer(bob.addr, 10_000 ether);
    }

    bytes32 constant DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );

    function _domainSeparator(address escrow) internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                DOMAIN_TYPEHASH,
                keccak256(bytes("DealSeal")),
                keccak256(bytes("1")),
                block.chainid,
                escrow
            )
        );
    }

    bytes32 constant ATTESTATION_TYPEHASH = keccak256(
        "Attestation(address wallet,bytes32 nameHash,bytes32 emailHash,bytes32 pdfHash,uint256 nonce,uint256 deadline)"
    );

    function _hashAttestation(Escrow.Attestation memory a) internal pure returns (bytes32) {
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

    function _attest(Vm.Wallet memory w, address escrow, bytes32 pdfHash, uint256 nonce)
        internal
        view
        returns (Escrow.Attestation memory a, bytes memory sig)
    {
        a = Escrow.Attestation({
            wallet: w.addr,
            nameHash: keccak256(abi.encode(w.addr, "name-salt")),
            emailHash: keccak256(abi.encode(w.addr, "email-salt")),
            pdfHash: pdfHash,
            nonce: nonce,
            deadline: block.timestamp + 1 days
        });
        // Hash structurally — the predicted clone address has no code yet,
        // so we can't ask it for the struct hash.
        bytes32 structHash = _hashAttestation(a);
        bytes32 digest = _toTypedData(_domainSeparator(escrow), structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(w, digest);
        sig = abi.encodePacked(r, s, v);
    }

    function _toTypedData(bytes32 sep, bytes32 structHash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", sep, structHash));
    }

    /// @dev Deploys via the factory using a deterministic salt so the test
    ///      can pre-sign EIP-712 attestations bound to the predicted address.
    ///      Going through the factory exercises `isEscrow` registration —
    ///      important because partyB countersign now calls back into it.
    function _createWithSig() internal returns (Escrow e) {
        bytes32 pdfHash = keccak256("pdf-bytes");
        bytes32 salt = keccak256(abi.encodePacked("salt", block.number));
        address predicted = factory.predictAddress(salt);

        (Escrow.Attestation memory a, bytes memory sig) =
            _attest(alice, predicted, pdfHash, 0);

        vm.prank(alice.addr);
        factory.createEscrowDeterministic(
            salt,
            token,
            1_000 ether,
            pdfHash,
            "bafy...",
            uint64(block.timestamp + 30 days),
            uint64(block.timestamp + 7 days),
            keccak256(abi.encodePacked(SECRET)),
            a,
            sig
        );
        e = Escrow(predicted);
    }

    function test_happyPath() public {
        Escrow e = _createWithSig();
        bytes32 pdfHash = keccak256("pdf-bytes");

        (Escrow.Attestation memory aB, bytes memory sigB) =
            _attest(bob, address(e), pdfHash, 0);

        vm.startPrank(bob.addr);
        token.approve(address(e), 1_000 ether);
        e.countersign(SECRET, aB, sigB);
        e.proposeRelease();
        vm.stopPrank();

        vm.prank(alice.addr);
        e.approveRelease();

        e.withdraw();

        assertEq(uint8(e.state()), uint8(Escrow.State.Closed));
        assertEq(token.balanceOf(alice.addr), 1_000 ether);

        // partyB is indexed too — reputation aggregates over both sides.
        assertEq(factory.partyEscrowCount(bob.addr), 1);
        assertEq(factory.partyEscrowCount(alice.addr), 1);
    }

    function test_recordCountersign_onlyEscrow() public {
        // External callers can't poison the per-party index.
        vm.expectRevert(EscrowFactory.NotEscrow.selector);
        factory.recordCountersign(bob.addr);
    }

    function test_initRejectsBadParams() public {
        bytes32 pdfHash = keccak256("pdf-bytes");
        bytes32 salt = keccak256("salt-bad");
        address predicted = factory.predictAddress(salt);
        (Escrow.Attestation memory a, bytes memory sig) =
            _attest(alice, predicted, pdfHash, 0);

        // Zero amount is rejected.
        vm.prank(alice.addr);
        vm.expectRevert(Escrow.InvalidInit.selector);
        factory.createEscrowDeterministic(
            salt,
            token,
            0,
            pdfHash,
            "bafy...",
            uint64(block.timestamp + 30 days),
            uint64(block.timestamp + 7 days),
            keccak256(abi.encodePacked(SECRET)),
            a,
            sig
        );

        // validUntil > deadline is rejected.
        salt = keccak256("salt-bad-2");
        predicted = factory.predictAddress(salt);
        (a, sig) = _attest(alice, predicted, pdfHash, 0);
        vm.prank(alice.addr);
        vm.expectRevert(Escrow.InvalidInit.selector);
        factory.createEscrowDeterministic(
            salt,
            token,
            1_000 ether,
            pdfHash,
            "bafy...",
            uint64(block.timestamp + 7 days),
            uint64(block.timestamp + 30 days),
            keccak256(abi.encodePacked(SECRET)),
            a,
            sig
        );
    }

    function test_cancelDispute_returnsToActive() public {
        Escrow e = _createWithSig();
        bytes32 pdfHash = keccak256("pdf-bytes");
        (Escrow.Attestation memory aB, bytes memory sigB) =
            _attest(bob, address(e), pdfHash, 0);

        vm.startPrank(bob.addr);
        token.approve(address(e), 1_000 ether);
        e.countersign(SECRET, aB, sigB);
        e.flagDispute("partial work");
        // Only the disputer can cancel.
        vm.stopPrank();
        vm.expectRevert(Escrow.NotDisputer.selector);
        vm.prank(alice.addr);
        e.cancelDispute();

        vm.prank(bob.addr);
        e.cancelDispute();
        assertEq(uint8(e.state()), uint8(Escrow.State.Active));

        // Release path works again after un-disputing.
        vm.prank(alice.addr);
        e.proposeRelease();
        vm.prank(bob.addr);
        e.approveRelease();
        e.withdraw();
        assertEq(token.balanceOf(alice.addr), 1_000 ether);
    }

    function test_badSecretReverts() public {
        Escrow e = _createWithSig();
        bytes32 pdfHash = keccak256("pdf-bytes");
        (Escrow.Attestation memory aB, bytes memory sigB) =
            _attest(bob, address(e), pdfHash, 0);

        vm.startPrank(bob.addr);
        token.approve(address(e), 1_000 ether);
        vm.expectRevert(Escrow.BadSecret.selector);
        e.countersign(keccak256("wrong"), aB, sigB);
        vm.stopPrank();
    }

    function test_linkExpired() public {
        Escrow e = _createWithSig();
        bytes32 pdfHash = keccak256("pdf-bytes");

        vm.warp(block.timestamp + 8 days);

        (Escrow.Attestation memory aB, bytes memory sigB) =
            _attest(bob, address(e), pdfHash, 0);

        vm.startPrank(bob.addr);
        token.approve(address(e), 1_000 ether);
        vm.expectRevert(Escrow.LinkExpired.selector);
        e.countersign(SECRET, aB, sigB);
        vm.stopPrank();
    }

    function test_disputeBlocksRelease() public {
        Escrow e = _createWithSig();
        bytes32 pdfHash = keccak256("pdf-bytes");
        (Escrow.Attestation memory aB, bytes memory sigB) =
            _attest(bob, address(e), pdfHash, 0);

        vm.startPrank(bob.addr);
        token.approve(address(e), 1_000 ether);
        e.countersign(SECRET, aB, sigB);
        e.flagDispute("partial work");
        vm.stopPrank();

        assertEq(uint8(e.state()), uint8(Escrow.State.Disputed));
        vm.expectRevert();
        vm.prank(alice.addr);
        e.proposeRelease();
    }

    function test_rescueAfterTimeout() public {
        Escrow e = _createWithSig();
        bytes32 pdfHash = keccak256("pdf-bytes");
        (Escrow.Attestation memory aB, bytes memory sigB) =
            _attest(bob, address(e), pdfHash, 0);

        vm.startPrank(bob.addr);
        token.approve(address(e), 1_000 ether);
        e.countersign(SECRET, aB, sigB);
        vm.stopPrank();

        // Before RESCUE_TIMEOUT past deadline → reverts.
        vm.warp(block.timestamp + 31 days);
        vm.expectRevert(Escrow.RescueTimeoutNotReached.selector);
        vm.prank(bob.addr);
        e.rescue();

        // After RESCUE_TIMEOUT past deadline → bob recovers.
        vm.warp(block.timestamp + 366 days);
        uint256 bobBefore = token.balanceOf(bob.addr);
        vm.prank(bob.addr);
        e.rescue();
        assertEq(token.balanceOf(bob.addr) - bobBefore, 1_000 ether);
        // Rescued, not Closed — keeps ReputationView from counting an
        // unhappy unwind as a successful completion.
        assertEq(uint8(e.state()), uint8(Escrow.State.Rescued));
    }

    function test_cancelDisputeFromReleasingRestoresReleasing() public {
        Escrow e = _createWithSig();
        bytes32 pdfHash = keccak256("pdf-bytes");
        (Escrow.Attestation memory aB, bytes memory sigB) =
            _attest(bob, address(e), pdfHash, 0);

        vm.startPrank(bob.addr);
        token.approve(address(e), 1_000 ether);
        e.countersign(SECRET, aB, sigB);
        vm.stopPrank();

        vm.prank(alice.addr);
        e.proposeRelease();
        assertEq(uint8(e.state()), uint8(Escrow.State.Releasing));

        // Bob disputes from Releasing, then withdraws the dispute.
        vm.prank(bob.addr);
        e.flagDispute("changed mind");
        vm.prank(bob.addr);
        e.cancelDispute();

        // State must restore to Releasing (not Active) so Alice's pending
        // proposal isn't griefed away.
        assertEq(uint8(e.state()), uint8(Escrow.State.Releasing));
        assertEq(e.proposedReleaseBy(), alice.addr);

        // And approveRelease still works.
        vm.prank(bob.addr);
        e.approveRelease();
        assertEq(uint8(e.state()), uint8(Escrow.State.Released));
    }

    function test_cannotApproveOwnProposal() public {
        Escrow e = _createWithSig();
        bytes32 pdfHash = keccak256("pdf-bytes");
        (Escrow.Attestation memory aB, bytes memory sigB) =
            _attest(bob, address(e), pdfHash, 0);

        vm.startPrank(bob.addr);
        token.approve(address(e), 1_000 ether);
        e.countersign(SECRET, aB, sigB);
        e.proposeRelease();
        vm.expectRevert(Escrow.CannotApproveOwnProposal.selector);
        e.approveRelease();
        vm.stopPrank();
    }
}
