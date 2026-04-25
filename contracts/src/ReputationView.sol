// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Escrow} from "./Escrow.sol";
import {EscrowFactory} from "./EscrowFactory.sol";

/// @title ReputationView — read-only aggregator over a wallet's Escrow history.
/// @notice Exposes counts + tier bands (§3.6) — does not return raw deal values.
contract ReputationView {
    EscrowFactory public immutable factory;

    struct Stats {
        uint256 completed;
        uint256 disputed;
        uint256 active;
        uint8 valueTier; // 0:none 1:<1k 2:<10k 3:<100k 4:>=100k (NZD-equiv)
    }

    constructor(EscrowFactory _factory) {
        factory = _factory;
    }

    function statsOf(address party) external view returns (Stats memory s) {
        uint256 n = factory.partyEscrowCount(party);
        uint256 completedValue;
        for (uint256 i = 0; i < n; i++) {
            address e = factory.escrowsByParty(party, i);
            Escrow.State st = Escrow(e).state();
            if (st == Escrow.State.Released) {
                s.completed++;
                completedValue += Escrow(e).amount();
            } else if (st == Escrow.State.Disputed) {
                s.disputed++;
            } else if (st == Escrow.State.Active || st == Escrow.State.Releasing) {
                s.active++;
            }
        }
        s.valueTier = _tier(completedValue);
    }

    function _tier(uint256 v) internal pure returns (uint8) {
        if (v == 0) return 0;
        if (v < 1_000 ether) return 1;
        if (v < 10_000 ether) return 2;
        if (v < 100_000 ether) return 3;
        return 4;
    }
}
