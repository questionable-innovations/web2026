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
        factory = new EscrowFactory(address(impl));
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
        bytes32 structHash = Escrow(escrow).hashAttestation(a);
        bytes32 digest = _toTypedData(_domainSeparator(escrow), structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(w, digest);
        sig = abi.encodePacked(r, s, v);
    }

    function _toTypedData(bytes32 sep, bytes32 structHash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", sep, structHash));
    }

    /// @dev We deploy the clone manually (not via factory) so the test can
    ///      pre-sign EIP-712 attestations bound to the eventual address —
    ///      `factory.createEscrow` requires the signed attestation up-front,
    ///      and the domain separator depends on the clone's address.
    function _createWithSig() internal returns (Escrow e) {
        bytes32 pdfHash = keccak256("pdf-bytes");
        e = Escrow(_cloneEscrow());

        (Escrow.Attestation memory a, bytes memory sig) =
            _attest(alice, address(e), pdfHash, 0);

        vm.prank(alice.addr);
        e.initialize(
            alice.addr,
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
    }

    function _cloneEscrow() internal returns (address out) {
        // EIP-1167 minimal clone of `impl`, deployed via the same Clones lib
        // the factory uses. Bypasses the factory just for tests so we can
        // pre-sign attestations bound to the eventual address.
        bytes20 target = bytes20(address(impl));
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
            mstore(add(ptr, 0x14), target)
            mstore(add(ptr, 0x28), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
            out := create(0, ptr, 0x37)
        }
        require(out != address(0), "clone failed");
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

        assertEq(uint8(e.state()), uint8(Escrow.State.Released));
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
