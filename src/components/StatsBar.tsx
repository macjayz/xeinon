import { Activity, TrendingUp, Coins, Users } from 'lucide-react';

interface GlobalStats {
  totalTokens?: number;
  newTokens24h?: number;
  totalVolume24h?: number;
  topGainer?: number;
  topGainerSymbol?: string;
}

interface StatsBarProps {
  stats?: GlobalStats | null;
}

const formatVolume = (num: number): string => {
  if (num >= 1000000) {
    return `$${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `$${(num / 1000).toFixed(1)}K`;
  }
  return `$${num.toFixed(0)}`;
};

export const StatsBar = ({ stats }: StatsBarProps) => {
  const displayStats = [
    {
      label: 'Total Volume 24h',
      value: stats?.totalVolume24h ? formatVolume(stats.totalVolume24h) : '$12.4M',
      change: '+23.5%',
      icon: Activity,
      positive: true,
    },
    {
      label: 'New Tokens',
      value: stats?.newTokens24h?.toString() || '147',
      change: '+12',
      icon: Coins,
      positive: true,
    },
    {
      label: 'Total Indexed',
      value: stats?.totalTokens?.toString() || '8,234',
      change: 'tokens',
      icon: Users,
      positive: true,
    },
    {
      label: 'Top Gainer',
      value: stats?.topGainer ? `+${stats.topGainer.toFixed(0)}%` : '+342%',
      change: stats?.topGainerSymbol?.slice(0, 6) || 'MRKT',
      icon: TrendingUp,
      positive: true,
    },
  ];

  return (
    <div className="border-b border-border/50 bg-card/30">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-6 overflow-x-auto py-3 scrollbar-hide">
          {displayStats.map((stat, index) => (
            <div
              key={index}
              className="flex items-center gap-3 whitespace-nowrap"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <stat.icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {stat.label}
                </p>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-foreground">
                    {stat.value}
                  </span>
                  <span className="text-xs font-medium text-gain">
                    {stat.change}
                  </span>
                </div>
              </div>
              {index < displayStats.length - 1 && (
                <div className="h-8 w-px bg-border/50 ml-3" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
