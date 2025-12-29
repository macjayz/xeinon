import { useParams, useNavigate } from 'react-router-dom';
import { useTokenDetail, useTokenHistory } from '@/hooks/useTokens';
import { useTrade, PAYMENT_TOKENS, PaymentTokenKey } from '@/hooks/useTrade';
import { Button } from '@/components/ui/button';
import { PlatformBadge } from '@/components/PlatformBadge';
import { TokenStageBadge } from '@/components/TokenStageBadge';
import { ConnectWallet } from '@/components/ConnectWallet';
import { 
  ArrowLeft, 
  ExternalLink, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Droplets,
  BarChart3,
  Copy,
  Check,
  Zap,
  Loader2
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { Address } from 'viem';

const formatPrice = (price: number): string => {
  if (price === 0) return '0.00';
  if (price >= 1) return price.toFixed(2);
  if (price >= 0.01) return price.toFixed(4);
  if (price >= 0.0001) return price.toFixed(6);
  
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

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
  if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`;
  return `$${num.toFixed(2)}`;
};

const formatCompact = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toFixed(0);
};

export default function TokenDetail() {
  const { address } = useParams<{ address: string }>();
  const navigate = useNavigate();
  const { data: token, isLoading, error } = useTokenDetail(address || null);
  const { data: history } = useTokenHistory(address || null);
  const [copied, setCopied] = useState(false);
  const [tradeAmount, setTradeAmount] = useState('0.01');
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  
  const {
    executeTrade,
    isLoading: isTrading,
    isConnected,
    tokenBalance,
    paymentToken,
    setPaymentToken,
    paymentTokenBalance,
    txHash,
  } = useTrade({
    tokenAddress: (address || '0x') as Address,
    tokenSymbol: token?.symbol || '',
    tokenName: token?.name,
  });

  const tokenBalanceNum = parseFloat(tokenBalance) || 0;
  const paymentTokenBalanceNum = parseFloat(paymentTokenBalance) || 0;

  const handleTrade = async () => {
    if (!isConnected) {
      return;
    }
    await executeTrade(activeTab, tradeAmount);
  };

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !token) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Token not found</p>
        <Button variant="outline" onClick={() => navigate('/') }>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Button>
      </div>
    );
  }

  const stats = Array.isArray(token.token_stats) ? token.token_stats[0] : token.token_stats;
  const price = Number(stats?.price) || 0;
  const priceChange = Number(stats?.price_change_24h) || 0;
  const volume = Number(stats?.volume_24h) || 0;
  const marketCap = Number(stats?.market_cap) || 0;
  const liquidity = Number(stats?.liquidity) || 0;
  const liquiditySource = stats?.liquidity_source as 'dex' | 'estimated' | null;
  const holders = stats?.holders || 0;
  const isPositive = priceChange >= 0;

  // Chart data - filter unique timestamps and ensure we have meaningful data
  const chartData = (history || [])
    .filter((h: any) => Number(h.price) > 0)
    .map((h: any) => ({
      time: new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      price: Number(h.price) || 0,
      volume: Number(h.volume) || 0,
    }))
    .reverse()
    // Remove duplicate timestamps (keep first occurrence)
    .filter((item: any, index: number, arr: any[]) => 
      index === 0 || item.time !== arr[index - 1].time
    );

  const presetAmounts = ['0.01', '0.025', '1', '10'];

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
                <Button variant="ghost" size="icon" onClick={() => navigate('/') }>
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

        <main className="container mx-auto px-4 py-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            {/* Left Column - Chart and Info */}
            <div className="space-y-6">
              {/* Token Header */}
              <div className="glass-card p-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-4">
                    <img
                      src={token.logo_url || `https://api.dicebear.com/7.x/shapes/svg?seed=${token.symbol}`}
                      alt={token.symbol}
                      className="h-16 w-16 rounded-xl bg-secondary"
                    />
                    <div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <h1 className="text-2xl font-bold text-foreground">{token.name}</h1>
                        <PlatformBadge platform={token.platform} />
                        {token.token_stage && <TokenStageBadge stage={token.token_stage} size="md" />}
                      </div>
                      <div className="flex flex-col gap-1 mt-1">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground font-mono">${token.symbol}</span>
                          <button
                            onClick={copyAddress}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <span className="font-mono">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </div>
                        {token.creator_address && (
                          <button
                            onClick={() => navigate(`/creator/${token.creator_address}`)}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-0.5"
                          >
                            <span className="uppercase tracking-wide text-[10px] text-muted-foreground/80">Creator</span>
                            <span className="font-mono">
                              {token.creator_address.slice(0, 6)}...{token.creator_address.slice(-4)}
                            </span>
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-3xl font-bold font-mono text-foreground">
                      ${formatPrice(price)}
                    </p>
                    <div className={cn(
                      'inline-flex items-center gap-1 mt-1 text-sm font-medium',
                      isPositive ? 'text-gain' : 'text-loss'
                    )}>
                      {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                      {isPositive ? '+' : ''}{priceChange.toFixed(2)}%
                    </div>
                  </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
                  <div className="rounded-lg bg-secondary/50 p-3 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Market Cap</p>
                    <p className="font-mono text-lg font-semibold text-foreground">{formatNumber(marketCap)}</p>
                  </div>
                  <div className="rounded-lg bg-secondary/50 p-3 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center justify-center gap-1">
                      <BarChart3 className="h-3 w-3" /> Volume 24h
                    </p>
                    <p className="font-mono text-lg font-semibold text-foreground">{formatNumber(volume)}</p>
                  </div>
                  <div className="rounded-lg bg-secondary/50 p-3 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center justify-center gap-1">
                      <Droplets className="h-3 w-3" /> 
                      {liquiditySource === 'estimated' ? 'Est. Liquidity' : 'Liquidity'}
                    </p>
                    <p className="font-mono text-lg font-semibold text-foreground">
                      {formatNumber(liquidity)}
                      {liquiditySource === 'estimated' && (
                        <span className="text-xs text-muted-foreground/70 ml-1" title="Estimated from bonding curve (~10% of market cap)">~</span>
                      )}
                    </p>
                    {liquiditySource === 'estimated' && (
                      <p className="text-[9px] text-muted-foreground/60 mt-0.5">Bonding curve est.</p>
                    )}
                  </div>
                  <div className="rounded-lg bg-secondary/50 p-3 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center justify-center gap-1">
                      <Users className="h-3 w-3" /> Holders
                    </p>
                    <p className="font-mono text-lg font-semibold text-foreground">{formatCompact(holders)}</p>
                  </div>
                </div>
              </div>

              {/* Price Chart */}
              <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-foreground">Price Chart</h2>
                  <div className="flex gap-2">
                    {['3m', '1m', '5d', '1d'].map((period) => (
                      <Button key={period} variant="ghost" size="sm" className="text-xs">
                        {period}
                      </Button>
                    ))}
                  </div>
                </div>
                
                <div className="h-[300px]">
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis 
                          dataKey="time" 
                          stroke="hsl(var(--muted-foreground))"
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        />
                        <YAxis 
                          stroke="hsl(var(--muted-foreground))" 
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                          tickFormatter={(value) => `$${formatPrice(value as number)}`}
                          domain={['dataMin', 'dataMax']}
                        />
                        <Tooltip 
                          contentStyle={{
                            background: 'hsl(var(--background))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '0.75rem',
                          }}
                          labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="price" 
                          stroke="hsl(var(--primary))" 
                          fill="url(#priceGradient)" 
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                      Not enough data to display chart yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Token Info */}
              <div className="glass-card p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4">Token Info</h2>
                <div className="grid gap-3 text-sm">
                  <div className="flex justify-between py-2 border-b border-border/50">
                    <span className="text-muted-foreground">Contract Address</span>
                    <a 
                      href={`https://basescan.org/token/${address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-primary hover:underline flex items-center gap-1"
                    >
                      {address?.slice(0, 10)}...{address?.slice(-8)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  {token.creator_address && (
                    <div className="flex justify-between py-2 border-b border-border/50">
                      <span className="text-muted-foreground">Creator</span>
                      <button 
                        onClick={() => navigate(`/creator/${token.creator_address}`)}
                        className="font-mono text-primary hover:underline flex items-center gap-1"
                      >
                        {token.creator_address?.slice(0, 10)}...{token.creator_address?.slice(-8)}
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  <div className="flex justify-between py-2 border-b border-border/50">
                    <span className="text-muted-foreground">Platform</span>
                    <span className="text-foreground">{token.platform}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border/50">
                    <span className="text-muted-foreground">Decimals</span>
                    <span className="font-mono text-foreground">{token.decimals}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">Created</span>
                    <span className="text-foreground">
                      {new Date(token.launch_timestamp).toLocaleString([], {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Trade Panel */}
            <div className="space-y-6">
              <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-foreground">Trade</h2>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Zap className="h-3 w-3 text-primary" />
                    Powered by Zora
                  </span>
                </div>

                <div className="flex gap-2 mb-4 rounded-lg bg-secondary/60 p-1">
                  <button
                    onClick={() => setActiveTab('buy')}
                    className={cn(
                      'flex-1 py-2 text-sm font-medium rounded-md transition-colors',
                      activeTab === 'buy'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Buy
                  </button>
                  <button
                    onClick={() => setActiveTab('sell')}
                    className={cn(
                      'flex-1 py-2 text-sm font-medium rounded-md transition-colors',
                      activeTab === 'sell'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Sell
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-muted-foreground">Amount ({PAYMENT_TOKENS[paymentToken].symbol})</label>
                      <button
                        className="text-xs text-primary hover:underline"
                        onClick={() => setTradeAmount(paymentTokenBalance)}
                      >
                        Max: {paymentTokenBalanceNum.toFixed(4)}
                      </button>
                    </div>
                  <div className="relative mt-1">
                    <input
                      type="number"
                      value={tradeAmount}
                      onChange={(e) => setTradeAmount(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                      min="0"
                      step="0.0001"
                    />
                    <div className="absolute inset-y-0 right-2 flex items-center">
                      <select
                        value={paymentToken}
                        onChange={(e) => setPaymentToken(e.target.value as PaymentTokenKey)}
                        className="bg-transparent text-xs text-muted-foreground focus:outline-none"
                      >
                        {Object.entries(PAYMENT_TOKENS).map(([key, token]) => (
                          <option key={key} value={key} className="bg-background text-foreground">
                            {token.symbol}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {presetAmounts.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setTradeAmount(amount)}
                      className="px-2 py-1 text-xs rounded-full bg-secondary/70 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                    >
                      {amount} {PAYMENT_TOKENS[paymentToken].symbol}
                    </button>
                  ))}
                </div>

                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Wallet Balance</span>
                    <span>
                      {tokenBalanceNum.toFixed(4)} {token.symbol}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>{PAYMENT_TOKENS[paymentToken].symbol} Balance</span>
                    <span>
                      {paymentTokenBalanceNum.toFixed(4)} {PAYMENT_TOKENS[paymentToken].symbol}
                    </span>
                  </div>
                </div>

                <Button
                  className="w-full mt-4 flex items-center justify-center gap-2"
                  onClick={handleTrade}
                  disabled={!isConnected || isTrading}
                >
                  {!isConnected ? (
                    'Connect Wallet to Trade'
                  ) : isTrading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      {activeTab === 'buy' ? 'Buy' : 'Sell'} {token.symbol}
                    </>
                  )}
                </Button>

                {txHash && (
                  <a
                    href={`https://basescan.org/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 block text-xs text-primary hover:underline text-center"
                  >
                    View transaction on BaseScan
                  </a>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
