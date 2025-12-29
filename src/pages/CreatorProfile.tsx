import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { CoinCard, DisplayCoin } from '@/components/CoinCard';
import { ConnectWallet } from '@/components/ConnectWallet';
import { 
  ArrowLeft, 
  ExternalLink, 
  Zap,
  Users,
  Coins,
  Copy,
  Check
} from 'lucide-react';
import { useState } from 'react';

export default function CreatorProfile() {
  const { address } = useParams<{ address: string }>();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  // Fetch creator profile
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['creator-profile', address],
    queryFn: async () => {
      if (!address) return null;
      const { data, error } = await supabase
        .from('creator_profiles')
        .select('*')
        .eq('address', address.toLowerCase())
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!address,
  });

  // Fetch tokens created by this address
  const { data: tokens, isLoading: tokensLoading } = useQuery({
    queryKey: ['creator-tokens', address],
    queryFn: async () => {
      if (!address) return [];
      const { data, error } = await supabase
        .from('tokens')
        .select(`
          *,
          token_stats (*)
        `)
        .eq('creator_address', address.toLowerCase())
        .order('launch_timestamp', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!address,
  });

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isLoading = profileLoading || tokensLoading;

  // Transform tokens to DisplayCoin format
  const displayCoins: DisplayCoin[] = (tokens || []).map((token: any) => {
    const stats = Array.isArray(token.token_stats) ? token.token_stats[0] : token.token_stats;
    return {
      address: token.address,
      name: token.name,
      symbol: token.symbol,
      price: Number(stats?.price) || 0,
      priceChange24h: Number(stats?.price_change_24h) || 0,
      volume24h: Number(stats?.volume_24h) || 0,
      marketCap: Number(stats?.market_cap) || 0,
      holders: stats?.holders || 0,
      liquidity: Number(stats?.liquidity) || 0,
      platform: token.platform,
      creatorAddress: token.creator_address || '',
      creatorName: profile?.display_name || `${address?.slice(0, 6)}...${address?.slice(-4)}`,
      creatorAvatar: profile?.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${address}`,
      creatorFarcaster: profile?.farcaster_handle || undefined,
      launchTimestamp: new Date(token.launch_timestamp).getTime(),
      logoUrl: token.logo_url || `https://api.dicebear.com/7.x/shapes/svg?seed=${token.symbol}`,
    };
  });

  const totalTokens = displayCoins.length;
  const totalHolders = displayCoins.reduce((sum, c) => sum + c.holders, 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
          <div className="container mx-auto px-4">
            <div className="flex h-16 items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/20 glow-primary">
                    <Zap className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-xl font-bold tracking-tight">
                    <span className="gradient-text">Base</span>
                    <span className="text-foreground">Index</span>
                  </span>
                </div>
              </div>
              <ConnectWallet />
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          {/* Creator Profile Header */}
          <div className="glass-card p-6 mb-8">
            <div className="flex flex-col sm:flex-row items-start gap-6">
              {/* Avatar */}
              <img
                src={profile?.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${address}`}
                alt="Creator"
                className="h-24 w-24 rounded-2xl bg-secondary border-2 border-primary/20 object-cover"
                onError={(e) => {
                  e.currentTarget.src = `https://api.dicebear.com/7.x/identicon/svg?seed=${address}`;
                }}
              />

              {/* Info */}
              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold text-foreground">
                    {profile?.display_name || 'Unknown Creator'}
                  </h1>
                  {profile?.farcaster_handle && (
                    <a
                      href={`https://warpcast.com/${profile.farcaster_handle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline text-sm flex items-center gap-1"
                    >
                      @{profile.farcaster_handle}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>

                {/* Address */}
                <button
                  onClick={copyAddress}
                  className="flex items-center gap-2 mt-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span className="font-mono">{address?.slice(0, 10)}...{address?.slice(-8)}</span>
                  {copied ? <Check className="h-4 w-4 text-gain" /> : <Copy className="h-4 w-4" />}
                </button>

                {/* Bio */}
                {profile?.bio && (
                  <p className="mt-3 text-muted-foreground max-w-2xl">{profile.bio}</p>
                )}

                {/* Stats */}
                <div className="flex gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-primary" />
                    <span className="text-foreground font-semibold">{totalTokens}</span>
                    <span className="text-muted-foreground text-sm">tokens launched</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="text-foreground font-semibold">{totalHolders.toLocaleString()}</span>
                    <span className="text-muted-foreground text-sm">total holders</span>
                  </div>
                  {profile?.followers && profile.followers > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-foreground font-semibold">{profile.followers.toLocaleString()}</span>
                      <span className="text-muted-foreground text-sm">followers</span>
                    </div>
                  )}
                </div>
              </div>

              {/* External Links */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`https://basescan.org/address/${address}`, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Basescan
                </Button>
              </div>
            </div>
          </div>

          {/* Tokens Grid */}
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Tokens by this Creator ({totalTokens})
            </h2>

            {displayCoins.length === 0 ? (
              <div className="glass-card p-12 text-center">
                <Coins className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No tokens found for this creator</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {displayCoins.map((coin, index) => (
                  <CoinCard key={coin.address} coin={coin} rank={index + 1} />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
