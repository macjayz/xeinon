import { cn } from '@/lib/utils';

export type FilterTab = 'new' | 'trending' | 'gainers' | 'losers';

interface FilterTabsProps {
  activeTab: FilterTab;
  onTabChange: (tab: FilterTab) => void;
}

export const FilterTabs = ({ activeTab, onTabChange }: FilterTabsProps) => {
  const tabs: { id: FilterTab; label: string }[] = [
    { id: 'new', label: 'New Launches' },
    { id: 'trending', label: 'Trending' },
    { id: 'gainers', label: 'Top Gainers' },
    { id: 'losers', label: 'Top Losers' },
  ];

  return (
    <div className="flex items-center gap-1 rounded-lg bg-secondary/50 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            'rounded-md px-4 py-2 text-sm font-medium transition-all duration-200',
            activeTab === tab.id
              ? 'bg-primary text-primary-foreground shadow-lg'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};
