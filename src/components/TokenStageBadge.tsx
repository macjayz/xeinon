import { cn } from '@/lib/utils';
import { Circle, Eye, DollarSign, Droplets, TrendingUp, Skull } from 'lucide-react';

type TokenStage = 'created' | 'discovered' | 'priced' | 'liquid' | 'traded' | 'dead';

interface TokenStageBadgeProps {
  stage: TokenStage;
  size?: 'sm' | 'md';
}

const stageConfig: Record<TokenStage, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  created: { 
    label: 'Created', 
    color: 'text-muted-foreground', 
    bgColor: 'bg-muted/50',
    icon: Circle 
  },
  discovered: { 
    label: 'Discovered', 
    color: 'text-blue-500', 
    bgColor: 'bg-blue-500/10',
    icon: Eye 
  },
  priced: { 
    label: 'Priced', 
    color: 'text-amber-500', 
    bgColor: 'bg-amber-500/10',
    icon: DollarSign 
  },
  liquid: { 
    label: 'Liquid', 
    color: 'text-cyan-500', 
    bgColor: 'bg-cyan-500/10',
    icon: Droplets 
  },
  traded: { 
    label: 'Traded', 
    color: 'text-gain', 
    bgColor: 'bg-gain/10',
    icon: TrendingUp 
  },
  dead: { 
    label: 'Dead', 
    color: 'text-loss', 
    bgColor: 'bg-loss/10',
    icon: Skull 
  },
};

export const TokenStageBadge = ({ stage, size = 'sm' }: TokenStageBadgeProps) => {
  const config = stageConfig[stage] || stageConfig.created;
  const Icon = config.icon;
  
  return (
    <div className={cn(
      'inline-flex items-center gap-1 rounded-full font-medium',
      config.bgColor,
      config.color,
      size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'
    )}>
      <Icon className={cn(size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
      <span>{config.label}</span>
    </div>
  );
};
