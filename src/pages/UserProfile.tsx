import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConnectWallet } from '@/components/ConnectWallet';
import { useEnsName } from '@/hooks/useEnsName';
import { 
  ArrowLeft, 
  Zap, 
  User, 
  Wallet, 
  Copy, 
  Check, 
  Edit2, 
  Save,
  History,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface UserData {
  id: string;
  wallet_address: string;
  display_name: string | null;
  avatar_url: string | null;
  ens_name: string | null;
  created_at: string;
  last_seen_at: string | null;
}

interface Transaction {
  id: string;
  type: string;
  token_address: string;
  token_symbol: string;
  token_name: string | null;
  amount: string;
  payment_token: string;
  payment_amount: string;
  tx_hash: string;
  created_at: string;
}

export default function UserProfile() {
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const { ensName } = useEnsName(address);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!address) {
        setIsLoading(false);
        return;
      }

      try {
        const walletAddress = address.toLowerCase();
        
        // Fetch user data and transactions in parallel
        const [userResult, txResult] = await Promise.all([
          supabase
            .from('users')
            .select('*')
            .eq('wallet_address', walletAddress)
            .single(),
          supabase
            .from('transactions')
            .select('*')
            .eq('wallet_address', walletAddress)
            .order('created_at', { ascending: false })
            .limit(50)
        ]);

        if (userResult.data) {
          setUserData(userResult.data);
          setDisplayName(userResult.data.display_name || '');
        }
        
        if (txResult.data) {
          setTransactions(txResult.data as Transaction[]);
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [address]);

  const handleSave = async () => {
    if (!address || !displayName.trim()) return;

    setIsSaving(true);
    try {
      // RLS policy requires x-wallet-address header for updates
      const { error } = await supabase
        .from('users')
        .update({
          display_name: displayName.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('wallet_address', address.toLowerCase());

      if (error) {
        toast.error('Failed to update profile');
        console.error('Error updating profile:', error);
      } else {
        toast.success('Profile updated!');
        setIsEditing(false);
        setUserData((prev) => prev ? { ...prev, display_name: displayName.trim() } : null);
      }
    } catch (err) {
      toast.error('Something went wrong');
      console.error('Failed to save:', err);
    } finally {
      setIsSaving(false);
    }
  };

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

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10">
          <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
            <div className="container mx-auto px-4">
              <div className="flex h-16 items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
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

          <main className="container mx-auto px-4 py-12">
            <div className="flex flex-col items-center justify-center gap-6 text-center">
              <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center">
                <Wallet className="h-10 w-10 text-muted-foreground" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Connect Your Wallet</h1>
              <p className="text-muted-foreground max-w-md">
                Connect your wallet to view your profile and transaction history.
              </p>
              <ConnectWallet />
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
          <div className="container mx-auto px-4">
            <div className="flex h-16 items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
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
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Profile Card */}
            <div className="glass-card p-6">
              <div className="flex items-start gap-4">
                <img
                  src={userData?.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${address}`}
                  alt="Avatar"
                  className="h-20 w-20 rounded-xl bg-secondary"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {isEditing ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="Enter display name"
                          className="max-w-xs"
                          autoFocus
                        />
                        <Button size="sm" onClick={handleSave} disabled={isSaving}>
                          {isSaving ? (
                            <div className="h-4 w-4 animate-spin border-2 border-primary-foreground border-t-transparent rounded-full" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <>
                        <h1 className="text-2xl font-bold text-foreground">
                          {userData?.display_name || 'Anonymous'}
                        </h1>
                        <Button size="sm" variant="ghost" onClick={() => setIsEditing(true)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                  
                  {/* Show ENS name prominently if available */}
                  {(userData?.ens_name || ensName) && (
                    <p className="text-sm text-primary mb-1">{userData?.ens_name || ensName}</p>
                  )}
                  
                  <button
                    onClick={copyAddress}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Wallet className="h-4 w-4" />
                    <span className="font-mono">{formatAddress(address || '')}</span>
                    {copied ? <Check className="h-3 w-3 text-gain" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="rounded-lg bg-secondary/50 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Member Since</p>
                  <p className="font-mono text-sm font-semibold text-foreground">
                    {userData?.created_at
                      ? new Date(userData.created_at).toLocaleDateString([], {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : '-'}
                  </p>
                </div>
                <div className="rounded-lg bg-secondary/50 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Last Active</p>
                  <p className="font-mono text-sm font-semibold text-foreground">
                    {userData?.last_seen_at
                      ? new Date(userData.last_seen_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '-'}
                  </p>
                </div>
              </div>
            </div>

            {/* Transaction History */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <History className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Transaction History</h2>
              </div>

              {transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-16 w-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
                    <History className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground">No transactions yet</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    Your buy and sell transactions will appear here
                  </p>
                  <Button variant="outline" className="mt-4" onClick={() => navigate('/')}>
                    Explore Tokens
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "h-8 w-8 rounded-full flex items-center justify-center",
                          tx.type === 'buy' ? "bg-gain/20" : "bg-loss/20"
                        )}>
                          {tx.type === 'buy' ? (
                            <ArrowDownRight className="h-4 w-4 text-gain" />
                          ) : (
                            <ArrowUpRight className="h-4 w-4 text-loss" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {tx.type === 'buy' ? 'Bought' : 'Sold'} {tx.token_symbol}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {tx.amount} {tx.type === 'buy' ? tx.payment_token : tx.token_symbol}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-xs text-muted-foreground">
                          {new Date(tx.created_at).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                        <a
                          href={`https://basescan.org/tx/${tx.tx_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-primary transition-colors"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
