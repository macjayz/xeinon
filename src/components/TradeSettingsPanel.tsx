import { useState } from 'react';
import { Settings, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useTradeSettings } from '@/hooks/useTradeSettings';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export const TradeSettingsPanel = () => {
  const [open, setOpen] = useState(false);
  const {
    activePreset,
    activeTab,
    presets,
    setActivePreset,
    setActiveTab,
    updatePreset,
  } = useTradeSettings();

  const currentSettings = presets[activePreset];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Settings className="h-5 w-5" />
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] font-bold flex items-center justify-center">
            {activePreset}
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-background border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Trade Settings</DialogTitle>
        </DialogHeader>
        
        {/* Preset Tabs */}
        <div className="flex gap-1 p-1 bg-secondary rounded-lg">
          {([1, 2, 3] as const).map((preset) => (
            <button
              key={preset}
              onClick={() => setActivePreset(preset)}
              className={cn(
                'flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all',
                activePreset === preset
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              PRESET {preset}
            </button>
          ))}
        </div>

        {/* Buy/Sell Toggle */}
        <div className="flex gap-1 p-1 bg-secondary rounded-lg">
          <button
            onClick={() => setActiveTab('buy')}
            className={cn(
              'flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all',
              activeTab === 'buy'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Buy settings
          </button>
          <button
            onClick={() => setActiveTab('sell')}
            className={cn(
              'flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all',
              activeTab === 'sell'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Sell settings
          </button>
        </div>

        {/* Settings Grid */}
        <div className="grid grid-cols-3 gap-3">
          {/* Slippage */}
          <div className="space-y-2">
            <div className="relative">
              <Input
                type="number"
                value={currentSettings.slippage}
                onChange={(e) =>
                  updatePreset(activePreset, { slippage: parseFloat(e.target.value) || 0 })
                }
                className="text-center pr-8 bg-secondary border-border"
                step="0.5"
                min="0"
                max="50"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
            </div>
            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              SLIPPAGE
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Input
              type="number"
              value={currentSettings.priority}
              onChange={(e) =>
                updatePreset(activePreset, { priority: parseFloat(e.target.value) || 0 })
              }
              className="text-center bg-secondary border-border"
              step="0.0001"
              min="0"
            />
            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              PRIORITY
            </div>
          </div>

          {/* Bribe */}
          <div className="space-y-2">
            <Input
              type="number"
              value={currentSettings.bribe}
              onChange={(e) =>
                updatePreset(activePreset, { bribe: parseFloat(e.target.value) || 0 })
              }
              className="text-center bg-secondary border-border"
              step="0.001"
              min="0"
            />
            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              BRIBE
            </div>
          </div>
        </div>

        {/* Quick Buy Amount */}
        <div className="space-y-2 pt-2 border-t border-border">
          <label className="text-sm font-medium text-foreground">Quick Buy Amount (ETH)</label>
          <Input
            type="number"
            value={currentSettings.quickBuyAmount}
            onChange={(e) =>
              updatePreset(activePreset, { quickBuyAmount: parseFloat(e.target.value) || 0 })
            }
            className="bg-secondary border-border"
            step="0.01"
            min="0"
            placeholder="0.01"
          />
          <p className="text-xs text-muted-foreground">
            Amount used when clicking "Buy Early" or "Buy" buttons
          </p>
        </div>

        {/* Summary */}
        <div className="p-3 bg-secondary/50 rounded-lg text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Active Preset:</span>
            <span className="font-medium">Preset {activePreset}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Quick Buy:</span>
            <span className="font-medium text-primary">{currentSettings.quickBuyAmount} ETH</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Slippage:</span>
            <span className="font-medium">{currentSettings.slippage}%</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
