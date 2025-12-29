import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export interface Token {
  id: string;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  total_supply: number | null;
  creator_address: string | null;
  platform: 'Zora' | 'Clanker' | 'Flaunch' | 'Mint Club' | 'Custom'; // DB stores 'Zora', UI maps to 'Base'
  factory_address: string | null;
  logo_url: string | null;
  metadata_uri: string | null;
  launch_timestamp: string;
  created_at: string;
  updated_at: string;
  // Backend-owned lifecycle fields
  token_stage: 'created' | 'discovered' | 'priced' | 'liquid' | 'traded' | 'dead';
  source: 'zora_ws' | 'zora_backfill' | 'dex' | 'bytecode_scan' | 'manual';
  creation_tx_hash: string | null;
  creation_block: number | null;
  creation_log_index: number | null;
}

export interface TokenStats {
  id: string;
  token_address: string;
  price: number;
  price_change_24h: number;
  volume_24h: number;
  market_cap: number;
  liquidity: number;
  liquidity_dex: number | null;
  liquidity_estimated: number | null;
  liquidity_source: 'dex' | 'estimated' | null;
  holders: number;
  updated_at: string;
}

export interface TokenWithStats extends Token {
  token_stats: TokenStats[] | null;
  // Flattened stats for convenience
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  liquidity: number;
  liquidityDex: number | null;
  liquidityEstimated: number | null;
  liquiditySource: 'dex' | 'estimated' | null;
  holders: number;
}

export type FilterType = 'new' | 'trending' | 'gainers' | 'losers';
export type DataQuality = 'active' | 'pending' | 'all';

// Backend-owned classification: active stages vs pending stages
const ACTIVE_STAGES: Array<'priced' | 'liquid' | 'traded'> = ['priced', 'liquid', 'traded'];
const PENDING_STAGES: Array<'created' | 'discovered'> = ['created', 'discovered'];

// Helper to transform token data with stats
function transformTokenData(data: any[]): TokenWithStats[] {
  return (data || []).map((token: any) => {
    const stats = Array.isArray(token.token_stats) 
      ? token.token_stats[0] 
      : token.token_stats;
    
    return {
      ...token,
      token_stats: stats ? [stats] : null,
      price: stats?.price || 0,
      priceChange24h: stats?.price_change_24h || 0,
      volume24h: stats?.volume_24h || 0,
      marketCap: stats?.market_cap || 0,
      liquidity: stats?.liquidity || 0,
      liquidityDex: stats?.liquidity_dex || null,
      liquidityEstimated: stats?.liquidity_estimated || null,
      liquiditySource: stats?.liquidity_source || null,
      holders: stats?.holders || 0,
    };
  }) as TokenWithStats[];
}

// Valid stages for gainers/losers (must have real price data)
const TRADEABLE_STAGES: Array<'priced' | 'liquid' | 'traded'> = ['priced', 'liquid', 'traded'];

// Fetch losers using strict two-step pattern
async function fetchLosers(search: string): Promise<TokenWithStats[]> {
  // Step 1: Get token addresses with NEGATIVE price change only
  const { data: statsData, error: statsError } = await supabase
    .from('token_stats')
    .select('token_address, price, price_change_24h, volume_24h, liquidity, holders, market_cap')
    .lt('price_change_24h', 0)  // CRITICAL: Only negative values
    .not('price_change_24h', 'is', null)
    .order('price_change_24h', { ascending: true })  // Most negative first
    .limit(50);

  if (statsError) {
    console.error('Error fetching loser stats:', statsError);
    throw statsError;
  }

  if (!statsData || statsData.length === 0) {
    return [];
  }

  const addresses = statsData.map(s => s.token_address);

  // Step 2: Fetch tokens with valid stages only
  let tokensQuery = supabase
    .from('tokens')
    .select('*')
    .in('address', addresses)
    .in('token_stage', TRADEABLE_STAGES);  // Stage gate: exclude 'created', 'discovered', 'dead'

  // Apply search filter if provided
  if (search) {
    tokensQuery = tokensQuery.or(`name.ilike.%${search}%,symbol.ilike.%${search}%,address.ilike.%${search}%`);
  }

  const { data: tokensData, error: tokensError } = await tokensQuery;

  if (tokensError) {
    console.error('Error fetching loser tokens:', tokensError);
    throw tokensError;
  }

  if (!tokensData || tokensData.length === 0) {
    return [];
  }

  // Step 3: Merge stats into tokens and sort client-side
  const statsMap = new Map(statsData.map(s => [s.token_address, s]));
  
  const merged: TokenWithStats[] = tokensData.map(token => {
    const stats = statsMap.get(token.address);
    return {
      ...token,
      token_stats: null,
      price: stats?.price || 0,
      priceChange24h: stats?.price_change_24h || 0,
      volume24h: stats?.volume_24h || 0,
      marketCap: stats?.market_cap || 0,
      liquidity: stats?.liquidity || 0,
      liquidityDex: null,
      liquidityEstimated: null,
      liquiditySource: null,
      holders: stats?.holders || 0,
    };
  });

  // Sort: most negative first, volume as tiebreaker
  return merged.sort((a, b) => {
    if (a.priceChange24h !== b.priceChange24h) {
      return a.priceChange24h - b.priceChange24h;
    }
    return (b.volume24h || 0) - (a.volume24h || 0);
  });
}

// Fetch gainers using two-step pattern
async function fetchGainers(search: string): Promise<TokenWithStats[]> {
  // Step 1: Get token addresses with positive price change
  const { data: statsData, error: statsError } = await supabase
    .from('token_stats')
    .select('token_address, price, price_change_24h, volume_24h, liquidity, holders, market_cap')
    .gt('price_change_24h', 0)
    .not('price_change_24h', 'is', null)
    .order('price_change_24h', { ascending: false })  // Most positive first
    .limit(50);

  if (statsError) {
    console.error('Error fetching gainer stats:', statsError);
    throw statsError;
  }

  if (!statsData || statsData.length === 0) {
    return [];
  }

  const addresses = statsData.map(s => s.token_address);

  // Step 2: Fetch tokens with valid stages only
  let tokensQuery = supabase
    .from('tokens')
    .select('*')
    .in('address', addresses)
    .in('token_stage', TRADEABLE_STAGES);

  if (search) {
    tokensQuery = tokensQuery.or(`name.ilike.%${search}%,symbol.ilike.%${search}%,address.ilike.%${search}%`);
  }

  const { data: tokensData, error: tokensError } = await tokensQuery;

  if (tokensError) {
    console.error('Error fetching gainer tokens:', tokensError);
    throw tokensError;
  }

  if (!tokensData || tokensData.length === 0) {
    return [];
  }

  // Step 3: Merge and sort
  const statsMap = new Map(statsData.map(s => [s.token_address, s]));
  
  const merged: TokenWithStats[] = tokensData.map(token => {
    const stats = statsMap.get(token.address);
    return {
      ...token,
      token_stats: null,
      price: stats?.price || 0,
      priceChange24h: stats?.price_change_24h || 0,
      volume24h: stats?.volume_24h || 0,
      marketCap: stats?.market_cap || 0,
      liquidity: stats?.liquidity || 0,
      liquidityDex: null,
      liquidityEstimated: null,
      liquiditySource: null,
      holders: stats?.holders || 0,
    };
  });

  return merged.sort((a, b) => b.priceChange24h - a.priceChange24h);
}

// Fetch tokens with stats
export function useTokens(filter: FilterType = 'new', search: string = '', dataQuality: DataQuality = 'all') {
  return useQuery({
    queryKey: ['tokens', filter, search, dataQuality],
    queryFn: async (): Promise<TokenWithStats[]> => {
      // For gainers/losers, use dedicated two-step query functions
      if (filter === 'losers') {
        return fetchLosers(search);
      }
      if (filter === 'gainers') {
        return fetchGainers(search);
      }

      let query = supabase
        .from('tokens')
        .select(
          `*, token_stats (*)`,
        );

      const trimmedSearch = search.trim();
      const looksLikeAddress = /^0x[a-fA-F0-9]{40}$/.test(trimmedSearch);

      // Apply search filter (server-side). If the user pastes an address, do an exact match.
      if (trimmedSearch) {
        if (looksLikeAddress) {
          query = query.eq('address', trimmedSearch.toLowerCase());
        } else {
          query = query.or(
            `name.ilike.%${trimmedSearch}%,symbol.ilike.%${trimmedSearch}%,address.ilike.%${trimmedSearch}%`,
          );
        }
        // When searching, broaden the window so results aren't silently excluded.
        query = query.limit(1000);
      } else {
        // Default: keep it lightweight.
        query = query.limit(100);
      }

      // Filter by token_stage (backend-owned classification)
      if (dataQuality === 'active') {
        query = query.in('token_stage', ACTIVE_STAGES);
      } else if (dataQuality === 'pending') {
        query = query.in('token_stage', PENDING_STAGES);
      }

      // Apply sorting based on filter
      if (filter === 'new' || filter === 'trending') {
        query = query.order('launch_timestamp', { ascending: false });
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching tokens:', error);
        throw error;
      }

      // Transform and flatten data
      let tokens = transformTokenData(data);

      // If searching for a specific address and no results, try to backfill from Zora
      if (looksLikeAddress && tokens.length === 0) {
        console.log(`Token ${trimmedSearch} not found, attempting backfill...`);
        try {
          const response = await supabase.functions.invoke('index-token', {
            body: { address: trimmedSearch.toLowerCase() }
          });

          if (response.data?.success) {
            console.log('Token backfilled, re-fetching...');
            // Re-fetch after backfill
            const { data: refetchData } = await supabase
              .from('tokens')
              .select(`*, token_stats (*)`)
              .eq('address', trimmedSearch.toLowerCase());
            
            if (refetchData && refetchData.length > 0) {
              tokens = transformTokenData(refetchData);
            }
          }
        } catch (backfillError) {
          console.error('Backfill failed:', backfillError);
        }
      }

      // Client-side sorting for trending (by volume)
      if (filter === 'trending') {
        tokens.sort((a, b) => b.volume24h - a.volume24h);
      }

      return tokens;
    },
    refetchInterval: filter === 'losers' ? 5000 : 30000,
    staleTime: filter === 'losers' ? 3000 : 10000,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}

// Fetch single token details - auto-backfills if not found
export function useTokenDetail(address: string | null) {
  return useQuery({
    queryKey: ['token', address],
    queryFn: async () => {
      if (!address) return null;

      const normalizedAddress = address.toLowerCase();

      // First, try to fetch from DB
      const { data, error } = await supabase
        .from('tokens')
        .select(`
          *,
          token_stats (*)
        `)
        .eq('address', normalizedAddress)
        .maybeSingle();

      if (error) {
        console.error('Error fetching token:', error);
        throw error;
      }

      // If found, return it
      if (data) {
        return data;
      }

      // Not found - try to backfill from Zora API
      console.log(`Token ${normalizedAddress} not indexed, attempting backfill...`);
      
      try {
        const response = await supabase.functions.invoke('index-token', {
          body: { address: normalizedAddress }
        });

        if (response.error) {
          console.error('Backfill error:', response.error);
          return null;
        }

        const result = response.data;
        
        if (!result?.success) {
          console.log('Backfill failed:', result?.error || 'Unknown error');
          return null;
        }

        console.log('Token backfilled successfully:', result.token);

        // Re-fetch the token from DB after backfill
        const { data: backfilledData, error: refetchError } = await supabase
          .from('tokens')
          .select(`
            *,
            token_stats (*)
          `)
          .eq('address', normalizedAddress)
          .maybeSingle();

        if (refetchError) {
          console.error('Error fetching backfilled token:', refetchError);
          throw refetchError;
        }

        return backfilledData;
      } catch (backfillError) {
        console.error('Backfill request failed:', backfillError);
        return null;
      }
    },
    enabled: !!address,
    retry: 1, // Reduce retries since backfill may naturally fail for non-Zora tokens
  });
}

// Fetch token price history
export function useTokenHistory(address: string | null) {
  return useQuery({
    queryKey: ['token-history', address],
    queryFn: async () => {
      if (!address) return [];

      const { data, error } = await supabase
        .from('token_history')
        .select('*')
        .eq('token_address', address.toLowerCase())
        .order('timestamp', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching token history:', error);
        throw error;
      }

      return data || [];
    },
    enabled: !!address,
  });
}

// Fetch aggregate stats
export function useGlobalStats() {
  return useQuery({
    queryKey: ['global-stats'],
    queryFn: async () => {
      // Get total tokens
      const { count: totalTokens } = await supabase
        .from('tokens')
        .select('*', { count: 'exact', head: true });

      // Get tokens in last 24h
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: newTokens24h } = await supabase
        .from('tokens')
        .select('*', { count: 'exact', head: true })
        .gte('launch_timestamp', yesterday);

      // Get top gainer (use maybeSingle to handle empty results)
      const { data: topGainer } = await supabase
        .from('token_stats')
        .select('token_address, price_change_24h')
        .order('price_change_24h', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Get total volume
      const { data: volumeData } = await supabase
        .from('token_stats')
        .select('volume_24h');

      const totalVolume = volumeData?.reduce((sum, s) => sum + (Number(s.volume_24h) || 0), 0) || 0;

      return {
        totalTokens: totalTokens || 0,
        newTokens24h: newTokens24h || 0,
        totalVolume24h: totalVolume,
        topGainer: topGainer?.price_change_24h || 0,
        topGainerSymbol: topGainer?.token_address || '',
      };
    },
    refetchInterval: 60000, // Refetch every minute
  });
}

// Real-time subscription hook
export function useRealtimeTokens() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Subscribe to new tokens
    const tokensChannel = supabase
      .channel('tokens-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tokens'
        },
        (payload) => {
          console.log('New token:', payload);
          // Invalidate queries to refetch
          queryClient.invalidateQueries({ queryKey: ['tokens'] });
          queryClient.invalidateQueries({ queryKey: ['global-stats'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tokens'
        },
        (payload) => {
          console.log('Token updated (stage change):', payload);
          // Invalidate queries to refetch when token_stage changes
          queryClient.invalidateQueries({ queryKey: ['tokens'] });
          if (payload.new && typeof payload.new === 'object' && 'address' in payload.new) {
            queryClient.invalidateQueries({ queryKey: ['token', (payload.new as any).address] });
          }
        }
      )
      .subscribe();

    // Subscribe to stats updates
    const statsChannel = supabase
      .channel('stats-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'token_stats'
        },
        (payload) => {
          console.log('Stats update:', payload);
          // Invalidate queries to refetch
          queryClient.invalidateQueries({ queryKey: ['tokens'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(tokensChannel);
      supabase.removeChannel(statsChannel);
    };
  }, [queryClient]);
}

// WebSocket connection to realtime indexer
// NOTE: This is notification-only. WebSocket messages trigger query invalidation,
// NOT optimistic inserts. The database is the single source of truth.
export function useIndexerWebSocket(onNewToken?: (token: Token) => void, onStatusChange?: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void) {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    const wsUrl = `wss://hwujkefkweovhqxxvnoj.supabase.co/functions/v1/realtime-indexer`;
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let pingInterval: NodeJS.Timeout | null = null;

    const connect = () => {
      console.log('🔌 Connecting to realtime indexer WebSocket...');
      onStatusChange?.('connecting');
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('✅ Connected to realtime indexer - listening for new Zora coins on Base');
        onStatusChange?.('connected');
        
        // Send periodic pings to keep connection alive
        pingInterval = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 Indexer message:', data);

          if (data.type === 'connected') {
            console.log('🎯 Indexer confirmed:', data.message);
          }

          if (data.type === 'new_token' && data.token) {
            console.log('🚀 New token detected via WS:', data.token.symbol, data.token.name);
            
            // NOTIFICATION ONLY: Invalidate queries to refetch from database.
            // Never insert WS payloads into cache - DB is the single source of truth.
            queryClient.invalidateQueries({ queryKey: ['tokens'] });
            queryClient.invalidateQueries({ queryKey: ['global-stats'] });
            
            // Callback for UI notifications (toasts, etc.)
            if (onNewToken) {
              onNewToken(data.token);
            }
          }

          if (data.type === 'new_block') {
            console.log('⛓️ New block:', data.blockNumber);
          }

          if (data.type === 'subscription_confirmed') {
            console.log('📡 Subscription confirmed:', data.subscriptionId);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('🔌 Indexer WebSocket closed, code:', event.code, 'reason:', event.reason);
        onStatusChange?.('disconnected');
        
        if (pingInterval) {
          clearInterval(pingInterval);
          pingInterval = null;
        }
        
        // Reconnect after 3 seconds
        reconnectTimeout = setTimeout(connect, 3000);
      };

      ws.onerror = (error) => {
        console.error('❌ Indexer WebSocket error:', error);
        onStatusChange?.('error');
      };
    };

    connect();

    return () => {
      if (ws) {
        ws.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (pingInterval) {
        clearInterval(pingInterval);
      }
    };
  }, [onStatusChange, queryClient]);
}
