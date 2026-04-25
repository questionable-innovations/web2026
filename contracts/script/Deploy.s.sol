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
        
        // Use 0x0 for platformWallet and aavePool initially, or placeholders if not set
        // Aave V3 on Avalanche C-Chain: 0x794a61358D6845594F94dc1DB02A252b5b4814aD
        address platformWallet = vm.envOr("PLATFORM_WALLET", address(0));
        address aavePool = vm.envOr("AAVE_POOL", address(0x794a61358D6845594F94dc1DB02A252b5b4814aD));

        EscrowFactory factory = new EscrowFactory(address(impl), platformWallet, aavePool);
        ReputationView view_ = new ReputationView(factory);
        vm.stopBroadcast();

        console2.log("Escrow impl:    ", address(impl));
        console2.log("EscrowFactory:  ", address(factory));
        console2.log("ReputationView: ", address(view_));
    }
}
