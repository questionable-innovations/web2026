import { http, createConfig } from "wagmi";
import { avalanche, avalancheFuji } from "wagmi/chains";
import { injected } from "wagmi/connectors";

const rpc = process.env.NEXT_PUBLIC_RPC_URL;

export const wagmiConfig = createConfig({
  chains: [avalancheFuji, avalanche],
  connectors: [injected()],
  ssr: true,
  transports: {
    [avalancheFuji.id]: http(rpc),
    [avalanche.id]: http(),
  },
});
