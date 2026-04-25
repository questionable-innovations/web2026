// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "./utils/Script.sol";
import {DealEscrow} from "../src/DealEscrow.sol";
import {DealFactory} from "../src/DealFactory.sol";

contract DeployCore is Script {
    function run() external returns (DealEscrow implementation, DealFactory factory) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerKey);
        implementation = new DealEscrow();
        factory = new DealFactory(address(implementation));
        vm.stopBroadcast();
    }
}
