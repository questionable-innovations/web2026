// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console2} from "forge-std/Script.sol";
import {Escrow} from "../src/Escrow.sol";
import {EscrowFactory} from "../src/EscrowFactory.sol";
import {ReputationView} from "../src/ReputationView.sol";

contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(pk);
        Escrow impl = new Escrow();
        EscrowFactory factory = new EscrowFactory(address(impl));
        ReputationView view_ = new ReputationView(factory);
        vm.stopBroadcast();

        console2.log("Escrow impl:    ", address(impl));
        console2.log("EscrowFactory:  ", address(factory));
        console2.log("ReputationView: ", address(view_));
    }
}
