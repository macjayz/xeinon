import { useEffect, useState } from 'react';
import { createPublicClient, http } from 'viem';
import { mainnet } from 'wagmi/chains';
import { normalize } from 'viem/ens';

// Create a client specifically for ENS (mainnet only)
const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http('https://eth.llamarpc.com'),
});

export function useEnsName(address: string | undefined) {
  const [ensName, setEnsName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const resolveEns = async () => {
      if (!address) {
        setEnsName(null);
        return;
      }

      setIsLoading(true);
      try {
        const name = await mainnetClient.getEnsName({
          address: address as `0x${string}`,
        });
        setEnsName(name);
      } catch (error) {
        console.error('Error resolving ENS:', error);
        setEnsName(null);
      } finally {
        setIsLoading(false);
      }
    };

    resolveEns();
  }, [address]);

  return { ensName, isLoading };
}
