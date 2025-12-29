import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Header } from "@/components/Header";
import { StatsBar } from "@/components/StatsBar";
import { FilterTabs, FilterTab } from "@/components/FilterTabs";
import { LiveIndicator } from "@/components/LiveIndicator";
import { CoinCard } from "@/components/CoinCard";
import { CoinTable } from "@/components/CoinTable";
import { RecentlyDetectedSection } from "@/components/RecentlyDetectedSection";
import {
  useTokens,
  useRealtimeTokens,
  useGlobalStats,
  useIndexerWebSocket,
  TokenWithStats,
  Token,
} from "@/hooks/useTokens";
import { useGraduatedTokens } from "@/hooks/useGraduatedTokens";
import { LayoutGrid, List, Loader2, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

// Display format for coins
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
  platform: "Zora" | "Base" | "Clanker" | "Flaunch" | "Mint Club" | "Custom";
  creatorAddress: string;
  creatorName: string;
  creatorAvatar: string;
  creatorFarcaster?: string;
  launchTimestamp: number;
  logoUrl?: string;
  isGraduated?: boolean;
  tokenStage?: 'created' | 'discovered' | 'priced' | 'liquid' | 'traded' | 'dead';
}

const Index = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("new");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [wsStatus, setWsStatus] = useState<"connecting" | "connected" | "disconnected" | "error">("connecting");
  const { toast } = useToast();
  
  // Track previous token prices for graduation detection
  const previousPricesRef = useRef<Map<string, number>>(new Map());
  
  // Graduated tokens tracking
  const { isGraduated, trackPriceChange } = useGraduatedTokens();

  // Real-time subscriptions
  useRealtimeTokens();

  // Fetch ACTIVE tokens only (with meaningful data)
  const { data: dbTokens, isLoading, error } = useTokens(activeTab, searchQuery, 'active');

  // Fetch PENDING tokens to enrich with prices
  const { data: pendingTokensForPrices } = useTokens('new', '', 'pending');

  // Fetch global stats
  const { data: globalStats } = useGlobalStats();
  
  // Track price changes to detect graduated tokens
  useEffect(() => {
    if (!dbTokens) return;
    
    dbTokens.forEach((token) => {
      const previousPrice = previousPricesRef.current.get(token.address) || 0;
      const currentPrice = Number(token.price) || 0;
      
      if (previousPrice !== currentPrice) {
        trackPriceChange(token.address, previousPrice, currentPrice);
      }
      
      previousPricesRef.current.set(token.address, currentPrice);
    });
  }, [dbTokens, trackPriceChange]);

  // WebSocket for live indexing notifications
  const handleNewToken = useCallback(
    (token: Token) => {
      toast({
        title: "🚀 New Token Detected!",
        description: `${token.name} (${token.symbol}) just launched on ${token.platform}`,
      });
    },
    [toast],
  );

  const handleStatusChange = useCallback((status: "connecting" | "connected" | "disconnected" | "error") => {
    setWsStatus(status);
    if (status === "connected") {
      console.log("🎯 WebSocket connected - now listening for new Zora coins on Base");
    }
  }, []);

  useIndexerWebSocket(handleNewToken, handleStatusChange);

  // Convert database tokens to display format with graduated status
  const displayCoins = useMemo(() => {
    if (!dbTokens || dbTokens.length === 0) {
      return [];
    }
    return dbTokens.map((token): DisplayCoin => ({
      address: token.address,
      name: token.name,
      symbol: token.symbol,
      price: Number(token.price) || 0,
      priceChange24h: Number(token.priceChange24h) || 0,
      volume24h: Number(token.volume24h) || 0,
      marketCap: Number(token.marketCap) || 0,
      holders: token.holders || 0,
      liquidity: Number(token.liquidity) || 0,
      liquidityDex: token.liquidityDex ?? null,
      liquidityEstimated: token.liquidityEstimated ?? null,
      liquiditySource: token.liquiditySource ?? null,
      platform: token.platform,
      creatorAddress: token.creator_address || "",
      creatorName: token.creator_address?.slice(0, 10) || "Unknown",
      creatorAvatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${token.creator_address || token.address}`,
      creatorFarcaster: undefined,
      launchTimestamp: new Date(token.launch_timestamp).getTime(),
      logoUrl: token.logo_url || `https://api.dicebear.com/7.x/shapes/svg?seed=${token.symbol}`,
      isGraduated: isGraduated(token.address),
      tokenStage: token.token_stage,
    }));
  }, [dbTokens, isGraduated]);

  // Fetch prices for pending tokens periodically
  useEffect(() => {
    const fetchPricesForTokens = async () => {
      if (!pendingTokensForPrices || pendingTokensForPrices.length === 0) {
        console.log("📊 No pending tokens to fetch prices for");
        return;
      }

      const addresses = pendingTokensForPrices.map((t) => t.address);
      console.log(`📊 Fetching prices for ${addresses.length} pending tokens...`);

      try {
        const { data, error } = await supabase.functions.invoke("fetch-prices", {
          body: { tokenAddresses: addresses },
        });

        if (error) {
          console.error("Error fetching prices:", error);
        } else {
          console.log("✅ Price fetch result:", data);
        }
      } catch (err) {
        console.error("Failed to fetch prices:", err);
      }
    };

    // Fetch on initial load
    fetchPricesForTokens();

    // Refetch every 60 seconds for faster updates
    const interval = setInterval(fetchPricesForTokens, 60000);
    return () => clearInterval(interval);
  }, [pendingTokensForPrices]);

  return (
    <div className="min-h-screen bg-background">
      {/* Background Glow Effect */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        <Header searchQuery={searchQuery} onSearchChange={setSearchQuery} />
        <StatsBar stats={globalStats} />

        <main className="container mx-auto px-4 py-8">
          {/* Header Section */}
          <div className="mb-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground mb-2">
                  Creator Coins on <span className="gradient-text">Base</span>
                </h1>
                <p className="text-muted-foreground">
                  Discover, track, and trade creator coins launched via Zora, Clanker, Flaunch, and more.
                </p>
              </div>
              <LiveIndicator status={wsStatus} />
            </div>
          </div>

          {/* Recently Detected Section (pending tokens with search) */}
          <RecentlyDetectedSection />

          {/* Active Tokens Section Header */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-1">Active Tokens</h2>
            <p className="text-sm text-muted-foreground">Tokens with confirmed price data</p>
          </div>

          {/* Filters & View Toggle */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <FilterTabs activeTab={activeTab} onTabChange={setActiveTab} />

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground mr-2">View:</span>
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "table" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("table")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Results Count */}
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading tokens...
                </span>
              ) : (
                <>
                  Showing <span className="font-medium text-foreground">{displayCoins.length}</span> active tokens
                </>
              )}
            </p>
          </div>

          {/* Error State */}
          {error && (
            <div className="mb-4 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
              Error loading tokens: {error.message}
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {/* Coins Display */}
          {!isLoading &&
            displayCoins.length > 0 &&
            (viewMode === "grid" ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {displayCoins.map((coin, index) => (
                  <CoinCard key={coin.address} coin={coin} rank={index + 1} />
                ))}
              </div>
            ) : (
              <CoinTable coins={displayCoins} />
            ))}

          {/* Empty State */}
          {!isLoading && displayCoins.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center mb-6">
                <Database className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">No tokens indexed yet</h3>
              <p className="text-muted-foreground max-w-md mb-6">
                The indexer is listening for new creator coin launches on Base. Tokens will appear here in real-time as
                they are deployed via Zora, Clanker, or Flaunch.
              </p>
              <div className="flex items-center gap-2 text-sm text-primary">
                <div className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
                </div>
                Listening for new tokens...
              </div>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-border/50 mt-16">
          <div className="container mx-auto px-4 py-8">
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
              <div className="flex items-center gap-2">
                <img src="/xeinon-logo.png" alt="XEINON" className="h-8 w-8 rounded-lg" />
                <span className="text-xl font-bold gradient-text">XEINON</span>
              </div>
              <p className="text-sm text-muted-foreground">Real-time creator coin indexer for Base L2</p>
              <div className="flex items-center gap-4">
                <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Docs
                </a>
                <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  API
                </a>
                <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  GitHub
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Index;
