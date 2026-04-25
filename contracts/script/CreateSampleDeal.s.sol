// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "./utils/Script.sol";
import {DealFactory} from "../src/DealFactory.sol";

contract CreateSampleDeal is Script {
    function run() external returns (address deal) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address factoryAddress = vm.envAddress("DEAL_FACTORY");
        address payer = vm.envAddress("DEMO_PAYER");
        address payee = vm.envAddress("DEMO_PAYEE");
        address token = vm.envAddress("SETTLEMENT_TOKEN");

        vm.startBroadcast(deployerKey);
        deal = DealFactory(factoryAddress).createDeal(
            DealFactory.CreateDealParams({
                payer: payer,
                payee: payee,
                settlementToken: token,
                amount: 1_000e6,
                pdfHash: keccak256("sample-pdf"),
                secretHash: keccak256(abi.encodePacked(bytes32(uint256(0x1234)))),
                payerIdentityHash: keccak256("demo-payer"),
                payeeIdentityHash: keccak256("demo-payee")
            })
        );
        vm.stopBroadcast();
    }
}
