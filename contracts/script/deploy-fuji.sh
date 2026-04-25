#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONTRACTS_DIR="$REPO_ROOT/contracts"

# Load project env if present so deploy works from a fresh shell.
if [[ -f "$REPO_ROOT/.env" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$REPO_ROOT/.env"
  set +a
fi

: "${DEPLOYER_PRIVATE_KEY:?DEPLOYER_PRIVATE_KEY is required (set it in .env or your shell).}"

# Foundry vm.envUint expects hex private keys to include the 0x prefix.
if [[ "$DEPLOYER_PRIVATE_KEY" != 0x* ]]; then
  export DEPLOYER_PRIVATE_KEY="0x$DEPLOYER_PRIVATE_KEY"
fi

RPC_URL="${NEXT_PUBLIC_RPC_URL:-https://api.avax-test.network/ext/bc/C/rpc}"

echo "Deploying to Avalanche Fuji (chainId=43113)"
echo "RPC: $RPC_URL"

cd "$CONTRACTS_DIR"

if [[ -n "${SNOWTRACE_API_KEY:-}" ]]; then
  forge script script/Deploy.s.sol:Deploy \
    --rpc-url "$RPC_URL" \
    --chain-id 43113 \
    --broadcast \
    --verify \
    -vvv
else
  echo "SNOWTRACE_API_KEY not set; skipping source verification."
  forge script script/Deploy.s.sol:Deploy \
    --rpc-url "$RPC_URL" \
    --chain-id 43113 \
    --broadcast \
    -vvv
fi