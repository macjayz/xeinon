import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTokens, TokenWithStats } from "@/hooks/useTokens";
import { Clock, Search, Loader2, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTradeSettings } from "@/hooks/useTradeSettings";
import { useTrade } from "@/hooks/useTrade";
import { Address } from "viem";

interface PendingTokenCardProps {
  token: TokenWithStats;
}

const PendingTokenCard = ({ token }: PendingTokenCardProps) => {
  const navigate = useNavigate();
  const logoUrl = token.logo_url || `https://api.dicebear.com/7.x/shapes/svg?seed=${token.symbol}`;
  const { getActiveSettings } = useTradeSettings();
  const { executeTrade, isLoading, isWalletReady } = useTrade({
    tokenAddress: token.address as Address,
    tokenSymbol: token.symbol,
    tokenName: token.name,
  });

  const getTimeAgo = (timestamp: string) => {
    const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const handleQuickBuy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const settings = getActiveSettings();
    await executeTrade('buy', settings.quickBuyAmount.toString());
  };

  return (
    <div
      onClick={() => navigate(`/token/${token.address}`)}
      className="flex items-center gap-3 p-4 rounded-xl bg-warning/5 border border-warning/20 hover:bg-warning/10 hover:border-warning/40 transition-all cursor-pointer group"
    >
      <div className="relative flex-shrink-0">
        <img
          src={logoUrl}
          alt={token.symbol}
          className="w-10 h-10 rounded-full bg-muted"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/shapes/svg?seed=${token.symbol}`;
          }}
        />
        <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-warning border-2 border-background flex items-center justify-center">
          <Loader2 className="w-2.5 h-2.5 animate-spin text-warning-foreground" />
        </div>
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground truncate">{token.symbol}</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-warning/20 text-warning-foreground">
            {token.platform}
          </span>
        </div>
        <span className="text-sm text-muted-foreground truncate block">{token.name}</span>
      </div>
      
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          {getTimeAgo(token.launch_timestamp)}
        </div>
        <Button 
          size="sm" 
          variant="outline"
          className="h-7 text-xs border-warning/30 hover:bg-warning/20 hover:border-warning"
          onClick={handleQuickBuy}
          disabled={isLoading}
        >
          <Zap className="w-3 h-3 mr-1" />
          {isLoading ? 'Buying...' : 'Buy Early'}
        </Button>
      </div>
    </div>
  );
};

export const RecentlyDetectedSection = () => {
  const [searchQuery, setSearchQuery] = useState("");

  // IMPORTANT: search must hit Supabase, not just the first 100 tokens currently loaded.
  const { data: pendingTokens, isLoading } = useTokens('new', searchQuery.trim(), 'pending');

  const displayTokens = useMemo(() => {
    if (!pendingTokens) return [];
    // Keep the grid light when not actively searching
    if (!searchQuery.trim()) return pendingTokens.slice(0, 20);
    return pendingTokens;
  }, [pendingTokens, searchQuery]);

  const totalPending = pendingTokens?.length || 0;

  if (isLoading) {
    return (
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Loader2 className="h-4 w-4 animate-spin text-warning" />
          <span className="text-sm text-muted-foreground">Loading recently detected tokens...</span>
        </div>
      </div>
    );
  }

  // If there are no pending tokens, still render when user is searching so they can query the DB.
  if (totalPending === 0 && !searchQuery.trim()) return null;

  return (
    <section className="mb-10" aria-label="Recently detected tokens">
      {/* Section Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative flex h-3 w-3" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-75"></span>
            <span className="relative inline-flex h-3 w-3 rounded-full bg-warning"></span>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Recently Detected
              <span className="ml-2 text-sm font-normal text-muted-foreground">({totalPending} tokens)</span>
            </h2>
            <p className="text-sm text-muted-foreground">
              New tokens awaiting price data • Buy early before they're indexed
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search pending tokens by name, symbol, or address…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-secondary/50 border-border/50"
          />
        </div>
      </div>

      {/* Tokens Grid */}
      {displayTokens.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {displayTokens.map((token) => (
            <PendingTokenCard key={token.address} token={token} />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">No tokens found matching "{searchQuery}"</div>
      )}

      {/* Divider */}
      <div className="mt-8 border-t border-border/50" />
    </section>
  );
};

