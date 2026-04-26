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

        // Leave Aave fully disabled unless all three values are supplied.
        // This keeps dNZD escrows on the plain non-yield path.
        address platformWallet = vm.envOr("PLATFORM_WALLET", address(0));
        address aavePool = vm.envOr("AAVE_POOL", address(0));
        address aaveSupportedToken = vm.envOr("AAVE_SUPPORTED_TOKEN", address(0));

        EscrowFactory factory = new EscrowFactory(
            address(impl),
            platformWallet,
            aavePool,
            aaveSupportedToken
        );
        ReputationView view_ = new ReputationView(factory);
        vm.stopBroadcast();

        console2.log("Escrow impl:    ", address(impl));
        console2.log("EscrowFactory:  ", address(factory));
        console2.log("ReputationView: ", address(view_));
    }
}
