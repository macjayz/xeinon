import { cn } from '@/lib/utils';

interface PlatformBadgeProps {
  platform: 'Zora' | 'Base' | 'Clanker' | 'Flaunch' | 'Mint Club' | 'Custom';
  size?: 'sm' | 'md';
}

const platformStyles: Record<string, string> = {
  Zora: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Base: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Clanker: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  Flaunch: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'Mint Club': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  Custom: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

// Map DB platform names to display names
const platformDisplayNames: Record<string, string> = {
  Zora: 'Base',
  Base: 'Base',
  Clanker: 'Clanker',
  Flaunch: 'Flaunch',
  'Mint Club': 'Mint Club',
  Custom: 'Custom',
};

export const PlatformBadge = ({ platform, size = 'sm' }: PlatformBadgeProps) => {
  const displayName = platformDisplayNames[platform] || platform;
  
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border font-medium',
        platformStyles[platform],
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'
      )}
    >
      {displayName}
    </span>
  );
};
