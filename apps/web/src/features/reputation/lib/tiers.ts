// Mirrors ReputationView.sol's tier bands so the same banding logic applies
// off-chain (where amounts come from SQLite) and on-chain (where they come
// from the Escrow.amount() view).
export type ValueTier = 0 | 1 | 2 | 3 | 4;

export function tierOf(amountNzd: number): ValueTier {
  if (!amountNzd || amountNzd <= 0) return 0;
  if (amountNzd < 1_000) return 1;
  if (amountNzd < 10_000) return 2;
  if (amountNzd < 100_000) return 3;
  return 4;
}

export const TIER_LABEL: Record<ValueTier, string> = {
  0: "—",
  1: "Under $1k",
  2: "$1k – $10k",
  3: "$10k – $100k",
  4: "$100k+",
};

export const TIER_NAME: Record<ValueTier, string> = {
  0: "newcomer",
  1: "starter",
  2: "established",
  3: "trusted",
  4: "high-value",
};
