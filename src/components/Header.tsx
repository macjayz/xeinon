import { Search, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { ConnectWallet } from './ConnectWallet';
import { TradeSettingsPanel } from './TradeSettingsPanel';
import { Link } from 'react-router-dom';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export const Header = ({ searchQuery, onSearchChange }: HeaderProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <img src="/xeinon-logo.png" alt="XEINON" className="h-9 w-9 rounded-lg" />
            <span className="text-xl font-bold tracking-tight gradient-text">
              XEINON
            </span>
          </Link>

          {/* Search Bar - Desktop */}
          <div className="hidden flex-1 max-w-xl md:flex">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by token name, symbol, or address..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full h-10 rounded-lg border border-border bg-secondary/50 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
              />
            </div>
          </div>

          {/* Navigation - Desktop */}
          <nav className="hidden items-center gap-6 md:flex">
            <a href="#" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
              New
            </a>
            <a href="#" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Trending
            </a>
            <a href="#" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Gainers
            </a>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <TradeSettingsPanel />
            <div className="hidden sm:block">
              <ConnectWallet />
            </div>
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Mobile Search */}
        <div className="pb-4 md:hidden">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search tokens..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full h-10 rounded-lg border border-border bg-secondary/50 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
            />
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="border-t border-border py-4 md:hidden animate-slide-up">
            <nav className="flex flex-col gap-2">
              <a href="#" className="px-2 py-2 text-sm font-medium text-foreground hover:text-primary transition-colors">
                New Launches
              </a>
              <a href="#" className="px-2 py-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                Trending
              </a>
              <a href="#" className="px-2 py-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                Top Gainers
              </a>
              <div className="mt-2">
                <ConnectWallet />
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};
