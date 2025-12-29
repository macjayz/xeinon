import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface TradePreset {
  slippage: number;      // Percentage (e.g., 5 = 5%)
  priority: number;      // ETH value for priority fee
  bribe: number;         // ETH value for bribe/tip
  quickBuyAmount: number; // ETH amount for quick buy
}

interface TradeSettingsState {
  activePreset: 1 | 2 | 3;
  activeTab: 'buy' | 'sell';
  presets: {
    1: TradePreset;
    2: TradePreset;
    3: TradePreset;
  };
  setActivePreset: (preset: 1 | 2 | 3) => void;
  setActiveTab: (tab: 'buy' | 'sell') => void;
  updatePreset: (preset: 1 | 2 | 3, settings: Partial<TradePreset>) => void;
  getActiveSettings: () => TradePreset;
}

const defaultPresets: TradeSettingsState['presets'] = {
  1: { slippage: 5, priority: 0.0001, bribe: 0.001, quickBuyAmount: 0.01 },
  2: { slippage: 10, priority: 0.0005, bribe: 0.005, quickBuyAmount: 0.05 },
  3: { slippage: 15, priority: 0.001, bribe: 0.01, quickBuyAmount: 0.1 },
};

export const useTradeSettings = create<TradeSettingsState>()(
  persist(
    (set, get) => ({
      activePreset: 1,
      activeTab: 'buy',
      presets: defaultPresets,
      
      setActivePreset: (preset) => set({ activePreset: preset }),
      
      setActiveTab: (tab) => set({ activeTab: tab }),
      
      updatePreset: (preset, settings) =>
        set((state) => ({
          presets: {
            ...state.presets,
            [preset]: { ...state.presets[preset], ...settings },
          },
        })),
      
      getActiveSettings: () => {
        const state = get();
        return state.presets[state.activePreset];
      },
    }),
    {
      name: 'xeinon-trade-settings',
    }
  )
);
