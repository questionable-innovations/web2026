import { http, createConfig } from "wagmi";
import { createConfig as createPrivyConfig } from "@privy-io/wagmi";
import { avalanche, avalancheFuji } from "wagmi/chains";
import { injected } from "wagmi/connectors";

const rpc = process.env.NEXT_PUBLIC_RPC_URL;

const chains = [avalancheFuji, avalanche] as const;
const transports = {
  [avalancheFuji.id]: http(rpc),
  [avalanche.id]: http(),
};

export const wagmiConfig = createConfig({
  chains,
  connectors: [injected()],
  ssr: true,
  transports,
});

// `@privy-io/wagmi` strips user-supplied connectors at runtime and injects its
// own via `useSyncPrivyWallets`. Passing a vanilla wagmi config to its
// `<WagmiProvider>` silently breaks the embedded-wallet proxy, so the Privy
// branch needs a config built with Privy's own `createConfig`.
export const privyWagmiConfig = createPrivyConfig({
  chains,
  transports,
});
