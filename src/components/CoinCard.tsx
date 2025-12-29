import { TrendingUp, TrendingDown, Users, Droplets, ExternalLink, BarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PlatformBadge } from './PlatformBadge';
import { GraduatedBadge } from './GraduatedBadge';
import { TokenStageBadge } from './TokenStageBadge';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useTradeSettings } from '@/hooks/useTradeSettings';
import { useTrade } from '@/hooks/useTrade';
import { Address } from 'viem';

export interface DisplayCoin {
  address: string;
  name: string;
  symbol: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  holders: number;
  liquidity: number;
  liquidityDex?: number | null;
  liquidityEstimated?: number | null;
  liquiditySource?: 'dex' | 'estimated' | null;
  platform: 'Zora' | 'Base' | 'Clanker' | 'Flaunch' | 'Mint Club' | 'Custom';
  creatorAddress: string;
  creatorName: string;
  creatorAvatar: string;
  creatorFarcaster?: string;
  launchTimestamp: number;
  logoUrl?: string;
  isGraduated?: boolean;
  tokenStage?: 'created' | 'discovered' | 'priced' | 'liquid' | 'traded' | 'dead';
}

interface CoinCardProps {
  coin: DisplayCoin;
  rank?: number;
}

const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return `$${(num / 1000000).toFixed(2)}M`;
  }
  if (num >= 1000) {
    return `$${(num / 1000).toFixed(1)}K`;
  }
  return `$${num.toFixed(2)}`;
};

const formatPrice = (price: number): string => {
  if (price === 0) return '0.00';
  if (price >= 1) return price.toFixed(2);
  if (price >= 0.01) return price.toFixed(4);
  if (price >= 0.0001) return price.toFixed(6);
  
  // For very small prices, use subscript notation: 0.0₅25 means 0.0000025
  const priceStr = price.toFixed(20);
  const match = priceStr.match(/^0\.(0+)([1-9]\d*)/);
  if (match) {
    const zeros = match[1].length;
    const significant = match[2].slice(0, 4);
    const subscriptDigits = '₀₁₂₃₄₅₆₇₈₉';
    const subscript = zeros.toString().split('').map(d => subscriptDigits[parseInt(d)]).join('');
    return `0.0${subscript}${significant}`;
  }
  return price.toFixed(8);
};

const getTimeAgo = (timestamp: number): string => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export const CoinCard = ({ coin, rank }: CoinCardProps) => {
  const navigate = useNavigate();
  const isPositive = coin.priceChange24h >= 0;
  const { getActiveSettings } = useTradeSettings();
  const { executeTrade, isLoading, isWalletReady } = useTrade({
    tokenAddress: coin.address as Address,
    tokenSymbol: coin.symbol,
    tokenName: coin.name,
  });

  const handleCardClick = () => {
    navigate(`/token/${coin.address}`);
  };

  const handleQuickBuy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const settings = getActiveSettings();
    await executeTrade('buy', settings.quickBuyAmount.toString());
  };

  const handleChart = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`https://dexscreener.com/base/${coin.address}`, '_blank');
  };

  return (
    <div 
      onClick={handleCardClick}
      className={cn(
        "glass-card p-4 hover:border-primary/30 transition-all duration-300 group animate-fade-in cursor-pointer relative overflow-hidden",
        coin.isGraduated && "animate-graduated border-primary/50"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Rank */}
        {rank && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-sm font-bold text-muted-foreground">
            #{rank}
          </div>
        )}

        {/* Token Logo */}
        <div className="relative">
          <img
            src={coin.logoUrl}
            alt={coin.symbol}
            className="h-12 w-12 rounded-xl bg-secondary"
          />
          <div className="absolute -bottom-1 -right-1">
            <PlatformBadge platform={coin.platform} />
          </div>
        </div>

        {/* Token Info */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground truncate max-w-[120px]" title={coin.name}>
              {coin.name}
            </h3>
            <span className="text-xs text-muted-foreground font-mono shrink-0">${coin.symbol.slice(0, 8)}</span>
            {coin.tokenStage && <TokenStageBadge stage={coin.tokenStage} />}
          </div>

          {/* Creator */}
          {coin.creatorAddress && (
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/creator/${coin.creatorAddress}`);
                }}
                className="flex items-center gap-2 hover:text-primary transition-colors"
              >
                <img
                  src={coin.creatorAvatar}
                  alt={coin.creatorName}
                  className="h-4 w-4 rounded-full"
                />
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground/80">Creator</span>
                <span className="text-xs text-muted-foreground truncate hover:text-primary">
                  {coin.creatorFarcaster || coin.creatorName}
                </span>
              </button>
              <span className="text-xs text-muted-foreground/60">•</span>
              <span className="text-xs text-muted-foreground/60">{getTimeAgo(coin.launchTimestamp)}</span>
            </div>
          )}
        </div>

        {/* Price & Change */}
        <div className="text-right shrink-0">
          <div className="flex items-center justify-end gap-1.5">
            <p className="font-mono text-sm font-semibold text-foreground">
              ${formatPrice(coin.price)}
            </p>
            {coin.isGraduated && <GraduatedBadge />}
          </div>
          <div
            className={cn(
              'flex items-center justify-end gap-1 text-xs font-medium',
              isPositive ? 'text-primary' : 'text-destructive'
            )}
          >
            {isPositive ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            <span>{isPositive ? '+' : ''}{coin.priceChange24h.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-secondary/50 p-2 text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Volume 24h</p>
          <p className="font-mono text-sm font-medium text-foreground">{formatNumber(coin.volume24h)}</p>
        </div>
        <div className="rounded-lg bg-secondary/50 p-2 text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center justify-center gap-1">
            <Droplets className="h-3 w-3" /> 
            {coin.liquiditySource === 'estimated' ? 'Est. Liq.' : 'Liquidity'}
          </p>
          <p className="font-mono text-sm font-medium text-foreground">
            {formatNumber(coin.liquidity)}
            {coin.liquiditySource === 'estimated' && <span className="text-[9px] text-muted-foreground/70 ml-0.5">~</span>}
          </p>
        </div>
        <div className="rounded-lg bg-secondary/50 p-2 text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center justify-center gap-1">
            <Users className="h-3 w-3" /> Holders
          </p>
          <p className="font-mono text-sm font-medium text-foreground">{coin.holders.toLocaleString()}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
        <Button 
          variant="buy" 
          size="sm" 
          className="flex-1"
          onClick={handleQuickBuy}
          disabled={isLoading}
        >
          {isLoading ? 'Buying...' : 'Buy'}
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="flex-1"
          onClick={handleChart}
        >
          <BarChart2 className="h-4 w-4 mr-1" />
          Chart
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            window.open(`https://basescan.org/token/${coin.address}`, '_blank');
          }}
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
