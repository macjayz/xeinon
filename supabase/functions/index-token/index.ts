import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Zora REST API endpoint
const ZORA_API_URL = 'https://api.zora.co/coins';

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { address } = await req.json();

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return new Response(
        JSON.stringify({ error: 'Invalid token address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedAddress = address.toLowerCase();
    console.log(`Indexing token: ${normalizedAddress}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if token already exists
    const { data: existing } = await supabase
      .from('tokens')
      .select('address')
      .eq('address', normalizedAddress)
      .maybeSingle();

    if (existing) {
      console.log(`Token ${normalizedAddress} already indexed`);
      return new Response(
        JSON.stringify({ success: true, message: 'Token already indexed', address: normalizedAddress }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch token data from Zora API
    const zoraUrl = `${ZORA_API_URL}/base/${normalizedAddress}`;
    console.log(`Fetching from Zora: ${zoraUrl}`);
    
    const zoraRes = await fetch(zoraUrl);
    
    if (!zoraRes.ok) {
      const errorText = await zoraRes.text();
      console.error(`Zora API error: ${zoraRes.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ error: 'Token not found on Zora', details: errorText }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const coinData = await zoraRes.json();
    console.log(`Zora response:`, JSON.stringify(coinData).slice(0, 500));

    if (!coinData || !coinData.address) {
      return new Response(
        JSON.stringify({ error: 'Invalid response from Zora API' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract token data
    const token = {
      address: coinData.address.toLowerCase(),
      name: coinData.name || 'Unknown',
      symbol: coinData.symbol || 'UNKNOWN',
      decimals: 18,
      platform: 'Zora' as const,
      source: 'manual' as const,
      token_stage: 'created' as const,
      chain: 'base',
      logo_url: coinData.mediaContent?.previewImage?.medium || coinData.mediaContent?.originalUri || null,
      metadata_uri: coinData.uri || null,
      creator_address: coinData.creatorAddress?.toLowerCase() || null,
      total_supply: coinData.totalSupply ? parseFloat(coinData.totalSupply) / 1e18 : null,
      launch_timestamp: coinData.createdAt || new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log(`Inserting token:`, JSON.stringify(token));

    // Insert token
    const { error: tokenError } = await supabase
      .from('tokens')
      .insert(token);

    if (tokenError) {
      console.error('Error inserting token:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Failed to insert token', details: tokenError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract and insert stats
    const marketCap = coinData.marketCap ? parseFloat(coinData.marketCap) : 0;
    const volume24h = coinData.volume24h ? parseFloat(coinData.volume24h) : 0;
    const priceChange24h = coinData.priceChange24h ? parseFloat(coinData.priceChange24h) : 0;
    const uniqueHolders = coinData.uniqueHolders || 0;
    
    // Calculate price from market cap and supply
    const totalSupply = coinData.totalSupply ? parseFloat(coinData.totalSupply) / 1e18 : 1e9;
    const price = totalSupply > 0 ? marketCap / totalSupply : 0;

    // Liquidity estimation
    const liquidityEstimated = marketCap * 0.1;

    const stats = {
      token_address: token.address,
      price,
      price_change_24h: priceChange24h,
      volume_24h: volume24h,
      market_cap: marketCap,
      liquidity: liquidityEstimated,
      liquidity_estimated: liquidityEstimated,
      liquidity_source: 'estimated',
      holders: uniqueHolders,
      updated_at: new Date().toISOString(),
    };

    console.log(`Inserting stats:`, JSON.stringify(stats));

    const { error: statsError } = await supabase
      .from('token_stats')
      .insert(stats);

    if (statsError) {
      console.error('Error inserting stats:', statsError);
      // Non-fatal, token is already inserted
    }

    // Update token stage based on stats
    let newStage = 'created';
    if (price > 0) newStage = 'priced';
    if (liquidityEstimated > 100) newStage = 'liquid';
    if (volume24h > 0) newStage = 'traded';

    if (newStage !== 'created') {
      await supabase
        .from('tokens')
        .update({ token_stage: newStage })
        .eq('address', token.address);
    }

    // Insert creator profile if available
    if (coinData.creatorAddress) {
      const creatorProfile = {
        address: coinData.creatorAddress.toLowerCase(),
        display_name: coinData.creatorProfile?.handle || null,
        avatar_url: coinData.creatorProfile?.avatar || null,
        bio: coinData.creatorProfile?.bio || null,
        farcaster_handle: coinData.creatorProfile?.handle || null,
        farcaster_fid: coinData.creatorProfile?.fid || null,
      };

      await supabase
        .from('creator_profiles')
        .upsert(creatorProfile, { onConflict: 'address' });
    }

    console.log(`Successfully indexed token: ${token.symbol} (${token.address})`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Token indexed successfully',
        token: {
          address: token.address,
          name: token.name,
          symbol: token.symbol,
          stage: newStage,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error indexing token:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
