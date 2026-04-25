// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface Vm {
    function prank(address msgSender) external;
    function startPrank(address msgSender) external;
    function stopPrank() external;
    function expectRevert(bytes4) external;
    function expectRevert(bytes calldata) external;
    function envUint(string calldata) external returns (uint256);
    function envAddress(string calldata) external returns (address);
    function addr(uint256 privateKey) external returns (address);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

abstract contract Test {
    Vm internal constant vm =
        Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function assertEq(uint256 left, uint256 right) internal pure {
        require(left == right, "assert eq uint256");
    }

    function assertEq(address left, address right) internal pure {
        require(left == right, "assert eq address");
    }

    function assertEq(bytes32 left, bytes32 right) internal pure {
        require(left == right, "assert eq bytes32");
    }

    function assertTrue(bool condition) internal pure {
        require(condition, "assert true");
    }
}
