import { TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PlatformBadge } from './PlatformBadge';
import { GraduatedBadge } from './GraduatedBadge';
import { TokenStageBadge } from './TokenStageBadge';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

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

interface CoinTableProps {
  coins: DisplayCoin[];
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
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
};

export const CoinTable = ({ coins }: CoinTableProps) => {
  const navigate = useNavigate();

  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50">
              <th className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                #
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Token
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Platform
              </th>
              <th className="px-4 py-3 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Price
              </th>
              <th className="px-4 py-3 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                24h %
              </th>
              <th className="px-4 py-3 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Volume
              </th>
              <th className="px-4 py-3 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground" title="DEX liquidity or estimated bonding curve liquidity (~)">
                Liquidity
              </th>
              <th className="px-4 py-3 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Holders
              </th>
              <th className="px-4 py-3 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Age
              </th>
              <th className="px-4 py-3 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {coins.map((coin, index) => {
              const isPositive = coin.priceChange24h >= 0;
              return (
                <tr
                  key={coin.address}
                  onClick={() => navigate(`/token/${coin.address}`)}
                  className={cn(
                    "border-b border-border/30 hover:bg-secondary/30 transition-colors cursor-pointer animate-fade-in",
                    coin.isGraduated && "animate-graduated bg-primary/5"
                  )}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-muted-foreground">
                      {index + 1}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={coin.logoUrl}
                        alt={coin.symbol}
                        className="h-8 w-8 rounded-lg bg-secondary"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">{coin.name}</p>
                          {coin.isGraduated && <GraduatedBadge />}
                          {coin.tokenStage && <TokenStageBadge stage={coin.tokenStage} />}
                        </div>
                        <p className="text-xs text-muted-foreground font-mono">
                          ${coin.symbol}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <PlatformBadge platform={coin.platform} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono text-sm text-foreground">
                      ${formatPrice(coin.price)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium',
                        isPositive ? 'bg-primary/20 text-primary' : 'bg-destructive/20 text-destructive'
                      )}
                    >
                      {isPositive ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {isPositive ? '+' : ''}
                      {coin.priceChange24h.toFixed(1)}%
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono text-sm text-foreground">
                      {formatNumber(coin.volume24h)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono text-sm text-foreground">
                      {formatNumber(coin.liquidity)}
                      {coin.liquiditySource === 'estimated' && <span className="text-[9px] text-muted-foreground/70 ml-0.5" title="Estimated from bonding curve">~</span>}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono text-sm text-foreground">
                      {coin.holders.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm text-muted-foreground">
                      {getTimeAgo(coin.launchTimestamp)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="buy" size="sm">
                        Buy
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => window.open(`https://basescan.org/token/${coin.address}`, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
