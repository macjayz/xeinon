import { http, createConfig } from 'wagmi';
import { base } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';

// WalletConnect project ID - you can get one at https://cloud.walletconnect.com
const projectId = 'YOUR_PROJECT_ID';

export const config = createConfig({
  chains: [base],
  connectors: [
    injected(),
    walletConnect({ projectId }),
  ],
  transports: {
    [base.id]: http(),
  },
});

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
