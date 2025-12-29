import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Wallet, LogOut, Copy, Check, ChevronDown, User } from 'lucide-react';
import { useState, useEffect } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { ProfileSetupDialog } from './ProfileSetupDialog';
import { useEnsName } from '@/hooks/useEnsName';

export function ConnectWallet() {
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { ensName } = useEnsName(address);
  const [copied, setCopied] = useState(false);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);

  // Save wallet to users table when connected and check if profile needs setup
  useEffect(() => {
    const saveUserAndCheckProfile = async () => {
      if (!address) return;

      try {
        const walletAddress = address.toLowerCase();
        
        // Check if user exists and has display_name
        const { data: existingUser } = await supabase
          .from('users')
          .select('display_name, ens_name')
          .eq('wallet_address', walletAddress)
          .single();

        if (existingUser && existingUser.display_name) {
          // User exists with profile, update last_seen and ENS if changed
          setDisplayName(existingUser.display_name);
          
          const updates: Record<string, any> = { last_seen_at: new Date().toISOString() };
          if (ensName && ensName !== existingUser.ens_name) {
            updates.ens_name = ensName;
          }
          
          await supabase
            .from('users')
            .update(updates)
            .eq('wallet_address', walletAddress);
          return;
        }

        // Upsert user record with ENS name
        const { error } = await supabase
          .from('users')
          .upsert(
            {
              wallet_address: walletAddress,
              avatar_url: `https://api.dicebear.com/7.x/identicon/svg?seed=${walletAddress}`,
              last_seen_at: new Date().toISOString(),
              ens_name: ensName || null,
            },
            { onConflict: 'wallet_address' }
          );

        if (error) {
          console.error('Error saving user:', error);
          return;
        }

        // Show profile setup dialog for new users or users without display_name
        setShowProfileSetup(true);
      } catch (err) {
        console.error('Failed to save user:', err);
      }
    };

    if (isConnected && address) {
      saveUserAndCheckProfile();
    }
  }, [isConnected, address, ensName]);

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const handleProfileComplete = () => {
    setShowProfileSetup(false);
    // Refresh display name
    if (address) {
      supabase
        .from('users')
        .select('display_name')
        .eq('wallet_address', address.toLowerCase())
        .single()
        .then(({ data }) => {
          if (data?.display_name) {
            setDisplayName(data.display_name);
          }
        });
    }
  };

  if (isConnected && address) {
    // Display ENS name if available, otherwise show truncated address
    const displayLabel = ensName || formatAddress(address);
    
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span className={ensName ? "text-xs" : "font-mono text-xs"}>{displayLabel}</span>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 bg-popover border-border">
          <DropdownMenuItem onClick={() => navigate('/profile')} className="gap-2 cursor-pointer">
            <User className="h-4 w-4" />
            {displayName || 'My Profile'}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={copyAddress} className="gap-2 cursor-pointer">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied!' : 'Copy Address'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => disconnect()} className="gap-2 cursor-pointer text-destructive">
            <LogOut className="h-4 w-4" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
        </DropdownMenu>
        <ProfileSetupDialog
          open={showProfileSetup}
          walletAddress={address}
          onComplete={handleProfileComplete}
        />
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isPending}>
          <Wallet className="mr-2 h-4 w-4" />
          {isPending ? 'Connecting...' : 'Connect'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-popover border-border">
        {connectors.map((connector) => (
          <DropdownMenuItem
            key={connector.uid}
            onClick={() => connect({ connector })}
            className="gap-2 cursor-pointer"
          >
            {connector.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}