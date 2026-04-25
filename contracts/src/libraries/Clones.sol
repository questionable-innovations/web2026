// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library Clones {
    error CloneCreationFailed();

    function clone(address implementation) internal returns (address instance) {
        assembly {
            let ptr := mload(0x40)
            mstore(
                ptr,
                or(
                    shr(0xe8, shl(0x60, implementation)),
                    0x3d602d80600a3d3981f3363d3d373d3d3d363d73
                )
            )
            mstore(add(ptr, 0x20), or(shl(0x78, implementation), 0x5af43d82803e903d91602b57fd5bf3))
            instance := create(0, ptr, 0x37)
        }

        if (instance == address(0)) {
            revert CloneCreationFailed();
        }
    }
}
