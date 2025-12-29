import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'list';
    const filter = url.searchParams.get('filter') || 'new';
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const search = url.searchParams.get('search') || '';
    const tokenAddress = url.searchParams.get('address');

    console.log(`API request: action=${action}, filter=${filter}, limit=${limit}`);

    // GET /api-tokens?action=list&filter=new|trending|gainers|losers
    if (action === 'list') {
      let query = supabase
        .from('tokens')
        .select(`
          *,
          token_stats (*)
        `)
        .limit(limit);

      // Apply search filter
      if (search) {
        query = query.or(`name.ilike.%${search}%,symbol.ilike.%${search}%,address.ilike.%${search}%`);
      }

      // Apply sorting based on filter
      if (filter === 'new') {
        query = query.order('launch_timestamp', { ascending: false });
      } else if (filter === 'trending') {
        query = query.order('token_stats(volume_24h)', { ascending: false, foreignTable: 'token_stats' });
      } else if (filter === 'gainers') {
        query = query.order('token_stats(price_change_24h)', { ascending: false, foreignTable: 'token_stats' });
      } else if (filter === 'losers') {
        query = query.order('token_stats(price_change_24h)', { ascending: true, foreignTable: 'token_stats' });
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching tokens:', error);
        throw error;
      }

      // Transform data to flatten stats
      const tokens = data?.map(token => ({
        ...token,
        price: token.token_stats?.[0]?.price || 0,
        priceChange24h: token.token_stats?.[0]?.price_change_24h || 0,
        volume24h: token.token_stats?.[0]?.volume_24h || 0,
        marketCap: token.token_stats?.[0]?.market_cap || 0,
        liquidity: token.token_stats?.[0]?.liquidity || 0,
        holders: token.token_stats?.[0]?.holders || 0,
      }));

      return new Response(JSON.stringify({ tokens }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /api-tokens?action=detail&address=0x...
    if (action === 'detail' && tokenAddress) {
      const { data: token, error: tokenError } = await supabase
        .from('tokens')
        .select(`
          *,
          token_stats (*),
          creator_profiles!tokens_creator_address_fkey (*)
        `)
        .eq('address', tokenAddress.toLowerCase())
        .single();

      if (tokenError) {
        console.error('Error fetching token:', tokenError);
        throw tokenError;
      }

      // Get price history
      const { data: history } = await supabase
        .from('token_history')
        .select('*')
        .eq('token_address', tokenAddress.toLowerCase())
        .order('timestamp', { ascending: false })
        .limit(100);

      return new Response(JSON.stringify({ token, history }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /api-tokens?action=stats
    if (action === 'stats') {
      // Get aggregate stats
      const { data: tokenCount } = await supabase
        .from('tokens')
        .select('id', { count: 'exact', head: true });

      const { data: recentTokens } = await supabase
        .from('tokens')
        .select('id')
        .gte('launch_timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      const { data: topGainer } = await supabase
        .from('token_stats')
        .select('token_address, price_change_24h')
        .order('price_change_24h', { ascending: false })
        .limit(1)
        .single();

      // Calculate total volume
      const { data: volumeData } = await supabase
        .from('token_stats')
        .select('volume_24h');

      const totalVolume = volumeData?.reduce((sum, s) => sum + (Number(s.volume_24h) || 0), 0) || 0;

      return new Response(JSON.stringify({
        totalTokens: tokenCount || 0,
        newTokens24h: recentTokens?.length || 0,
        totalVolume24h: totalVolume,
        topGainer: topGainer,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in api-tokens function:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
