import { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient, useWalletClient, useBalance } from 'wagmi';
import { parseUnits, formatUnits, Address, erc20Abi } from 'viem';
import { base } from 'wagmi/chains';
import { tradeCoin, type TradeParameters } from '@zoralabs/coins-sdk';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useTradeSettings } from './useTradeSettings';

export type TradeType = 'buy' | 'sell';

// Supported payment tokens on Base
export const PAYMENT_TOKENS = {
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    address: null as Address | null, // Native token
    decimals: 18,
    logo: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address,
    decimals: 6,
    logo: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
  },
  WETH: {
    symbol: 'WETH',
    name: 'Wrapped Ether',
    address: '0x4200000000000000000000000000000000000006' as Address,
    decimals: 18,
    logo: 'https://assets.coingecko.com/coins/images/2518/small/weth.png',
  },
} as const;

export type PaymentTokenKey = keyof typeof PAYMENT_TOKENS;

interface UseTradeProps {
  tokenAddress: Address;
  tokenSymbol: string;
  tokenName?: string;
}

export function useTrade({ tokenAddress, tokenSymbol, tokenName }: UseTradeProps) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient, isLoading: walletClientLoading } = useWalletClient();
  const { getActiveSettings } = useTradeSettings();
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [tokenBalanceValue, setTokenBalanceValue] = useState('0');
  const [paymentToken, setPaymentToken] = useState<PaymentTokenKey>('ETH');
  const [paymentTokenBalance, setPaymentTokenBalance] = useState('0');

  // Get ETH balance
  const { data: ethBalance } = useBalance({
    address,
  });

  // Fetch token balance manually
  const fetchTokenBalance = useCallback(async () => {
    if (!address || !publicClient || !tokenAddress) return;
    try {
      const balance = await publicClient.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address],
      } as any);
      setTokenBalanceValue(formatUnits(balance as bigint, 18));
    } catch (error) {
      console.error('Error fetching token balance:', error);
    }
  }, [address, publicClient, tokenAddress]);

  // Fetch payment token balance
  const fetchPaymentTokenBalance = useCallback(async () => {
    if (!address || !publicClient) return;
    
    const selectedToken = PAYMENT_TOKENS[paymentToken];
    
    if (!selectedToken.address) {
      // ETH balance
      setPaymentTokenBalance(ethBalance ? formatUnits(ethBalance.value, 18) : '0');
      return;
    }
    
    try {
      const balance = await publicClient.readContract({
        address: selectedToken.address,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address],
      } as any);
      setPaymentTokenBalance(formatUnits(balance as bigint, selectedToken.decimals));
    } catch (error) {
      console.error('Error fetching payment token balance:', error);
      setPaymentTokenBalance('0');
    }
  }, [address, publicClient, paymentToken, ethBalance]);

  useEffect(() => {
    fetchTokenBalance();
  }, [fetchTokenBalance]);

  useEffect(() => {
    fetchPaymentTokenBalance();
  }, [fetchPaymentTokenBalance]);

  const executeTrade = async (type: TradeType, amountStr: string) => {
    // More detailed connection check
    if (!isConnected) {
      toast.error('Please connect your wallet first');
      return null;
    }

    if (!address) {
      toast.error('Wallet address not found. Please reconnect.');
      return null;
    }

    // Wait for wallet client if still loading
    if (walletClientLoading) {
      toast.error('Wallet is initializing, please try again in a moment');
      return null;
    }

    if (!walletClient) {
      toast.error('Wallet client not ready. Please try again or reconnect your wallet.');
      return null;
    }

    if (!publicClient) {
      toast.error('Network connection issue. Please refresh the page.');
      return null;
    }

    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return null;
    }

    const selectedToken = PAYMENT_TOKENS[paymentToken];
    const settings = getActiveSettings();

    // Check balance
    if (type === 'buy') {
      const balanceNum = parseFloat(paymentTokenBalance);
      if (amount > balanceNum) {
        toast.error(`Insufficient ${selectedToken.symbol} balance. You have ${balanceNum.toFixed(4)} ${selectedToken.symbol}`);
        return null;
      }
    } else {
      const tokenBalanceNum = parseFloat(tokenBalanceValue);
      if (amount > tokenBalanceNum) {
        toast.error(`Insufficient ${tokenSymbol} balance`);
        return null;
      }
    }

    setIsLoading(true);
    setTxHash(null);

    try {
      const amountIn = parseUnits(amountStr, type === 'buy' ? selectedToken.decimals : 18);
      const zoraFactoryAddress = '0x777777751622c0d3258f214f9df38e35bf45baf3' as Address;
      
      // Use slippage from settings (convert from percentage to decimal)
      const slippage = settings.slippage / 100;

      if (type === 'buy') {
        // If using ERC20 token, need to approve first
        if (selectedToken.address) {
          const allowance = await publicClient.readContract({
            address: selectedToken.address,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [address, zoraFactoryAddress],
          } as any);

          if ((allowance as bigint) < amountIn) {
            toast.loading(`Approving ${selectedToken.symbol}...`, { id: 'trade' });
            
            const approveHash = await walletClient.writeContract({
              address: selectedToken.address,
              abi: erc20Abi,
              functionName: 'approve',
              args: [zoraFactoryAddress, amountIn],
              chain: base,
            } as any);

            await publicClient.waitForTransactionReceipt({ hash: approveHash });
          }
        }

        const tradeParameters: TradeParameters = {
          sell: selectedToken.address 
            ? { type: 'erc20' as const, address: selectedToken.address }
            : { type: 'eth' as const },
          buy: {
            type: 'erc20' as const,
            address: tokenAddress,
          },
          amountIn,
          slippage,
          sender: address,
        };

        toast.loading('Confirming transaction...', { id: 'trade' });

        const receipt = await tradeCoin({
          tradeParameters,
          walletClient: walletClient as any,
          account: address,
          publicClient: publicClient as any,
        });

        setTxHash(receipt.transactionHash);
        
        // Record transaction in database
        await supabase.from('transactions').insert({
          wallet_address: address.toLowerCase(),
          type: 'buy',
          token_address: tokenAddress.toLowerCase(),
          token_symbol: tokenSymbol,
          token_name: tokenName || null,
          amount: amountStr,
          payment_token: selectedToken.symbol,
          payment_amount: amountStr,
          tx_hash: receipt.transactionHash,
          chain: 'base',
        });
        
        toast.success(`Successfully bought ${tokenSymbol}!`, { id: 'trade' });
        await fetchTokenBalance();
        await fetchPaymentTokenBalance();
        return receipt;
      } else {
        // Sell: Token -> Payment Token
        const allowance = await publicClient.readContract({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [address, zoraFactoryAddress],
        } as any);

        if ((allowance as bigint) < amountIn) {
          toast.loading('Approving tokens...', { id: 'trade' });
          
          const approveHash = await walletClient.writeContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'approve',
            args: [zoraFactoryAddress, amountIn],
            chain: base,
          } as any);

          await publicClient.waitForTransactionReceipt({ hash: approveHash });
        }

        toast.loading('Confirming sell transaction...', { id: 'trade' });

        const tradeParameters: TradeParameters = {
          sell: {
            type: 'erc20' as const,
            address: tokenAddress,
          },
          buy: selectedToken.address 
            ? { type: 'erc20' as const, address: selectedToken.address }
            : { type: 'eth' as const },
          amountIn,
          slippage,
          sender: address,
        };

        const receipt = await tradeCoin({
          tradeParameters,
          walletClient: walletClient as any,
          account: address,
          publicClient: publicClient as any,
        });

        setTxHash(receipt.transactionHash);
        
        // Record transaction in database
        await supabase.from('transactions').insert({
          wallet_address: address.toLowerCase(),
          type: 'sell',
          token_address: tokenAddress.toLowerCase(),
          token_symbol: tokenSymbol,
          token_name: tokenName || null,
          amount: amountStr,
          payment_token: selectedToken.symbol,
          payment_amount: amountStr,
          tx_hash: receipt.transactionHash,
          chain: 'base',
        });
        
        toast.success(`Successfully sold ${tokenSymbol}!`, { id: 'trade' });
        await fetchTokenBalance();
        await fetchPaymentTokenBalance();
        return receipt;
      }
    } catch (error: any) {
      console.error('Trade error:', error);
      const message = error?.shortMessage || error?.message || 'Transaction failed';
      toast.error(message, { id: 'trade' });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Compute ready state - true if wallet is fully ready to trade
  const isWalletReady = isConnected && !!address && !!walletClient && !walletClientLoading;

  return {
    executeTrade,
    isLoading,
    txHash,
    isConnected,
    isWalletReady,
    walletClientLoading,
    address,
    paymentToken,
    setPaymentToken,
    paymentTokenBalance,
    tokenBalance: tokenBalanceValue,
    refetchTokenBalance: fetchTokenBalance,
  };
}
