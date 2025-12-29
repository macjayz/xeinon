import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Zora API for listing coins - much more efficient than Alchemy logs
const ZORA_COINS_API = "https://api-sdk.zora.engineering/coins";

interface BackfillOptions {
  count?: number; // Number of tokens to fetch
  after?: string; // Cursor for pagination
  sortDirection?: 'ASC' | 'DESC'; // Sort by creation time
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ZORA_API_KEY = Deno.env.get("ZORA_API_KEY");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const body = await req.json().catch(() => ({}));
    const options: BackfillOptions = {
      count: body.count || 100,
      after: body.after,
      sortDirection: body.sortDirection || 'DESC', // Most recent first by default
    };

    console.log(`Starting backfill with options:`, options);

    // Build Zora API URL - use the coins listing endpoint
    const params = new URLSearchParams({
      chain: '8453', // Base chain ID
      count: String(Math.min(options.count || 100, 100)), // API max is usually 100
    });
    
    if (options.after) {
      params.set('after', options.after);
    }
    
    if (options.sortDirection) {
      params.set('sortDirection', options.sortDirection);
    }

    const headers: Record<string, string> = { Accept: "application/json" };
    if (ZORA_API_KEY) {
      headers["api-key"] = ZORA_API_KEY;
    }

    console.log(`Fetching from Zora API: ${ZORA_COINS_API}?${params.toString()}`);

    const response = await fetch(`${ZORA_COINS_API}?${params.toString()}`, { headers });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Zora API error: ${response.status} ${errorText}`);
      throw new Error(`Zora API error: ${response.status}`);
    }

    const data = await response.json();
    const coins = data.coins || data.zora20Tokens || data.data || [];
    const nextCursor = data.nextCursor || data.cursor || null;

    console.log(`Zora API returned ${coins.length} coins`);

    let indexed = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const coin of coins) {
      try {
        const address = (coin.address || coin.contractAddress || coin.tokenAddress)?.toLowerCase();
        if (!address) {
          console.log('Skipping coin without address:', coin);
          continue;
        }

        // Check if already exists
        const { data: existing } = await supabase
          .from("tokens")
          .select("address")
          .eq("address", address)
          .maybeSingle();

        if (existing) {
          skipped++;
          continue;
        }

        // Extract data from Zora API response
        const name = coin.name || coin.symbol || 'Unknown';
        const symbol = coin.symbol || coin.name || 'UNKNOWN';
        const creatorAddress = (coin.creatorAddress || coin.creator || coin.deployer)?.toLowerCase();
        const decimals = coin.decimals || 18;
        const totalSupply = parseFloat(coin.totalSupply) || null;
        
        // Extract creation info
        const creationTxHash = coin.creationTxHash || coin.txHash || null;
        const creationBlock = coin.creationBlock || coin.blockNumber || null;
        const creationLogIndex = coin.logIndex || null;
        
        // Extract timestamp
        let launchTimestamp = new Date().toISOString();
        if (coin.createdAt) {
          launchTimestamp = new Date(coin.createdAt).toISOString();
        } else if (coin.timestamp) {
          launchTimestamp = new Date(coin.timestamp).toISOString();
        } else if (coin.blockTimestamp) {
          launchTimestamp = new Date(parseInt(coin.blockTimestamp) * 1000).toISOString();
        }

        // Extract logo
        const logoUrl = coin.mediaContent?.previewImage?.medium || 
                       coin.mediaContent?.previewImage?.small ||
                       coin.mediaContent?.originalUri ||
                       coin.image ||
                       coin.imageUrl || null;

        // Insert token
        const { error: tokenError } = await supabase.from("tokens").upsert({
          address,
          name,
          symbol,
          decimals,
          total_supply: totalSupply,
          platform: "Zora",
          source: "zora_backfill",
          token_stage: "discovered",
          creator_address: creatorAddress,
          factory_address: "0x777777751622c0d3258f214f9df38e35bf45baf3",
          creation_tx_hash: creationTxHash,
          creation_block: creationBlock,
          creation_log_index: creationLogIndex,
          chain: "base",
          launch_timestamp: launchTimestamp,
          first_seen_at: launchTimestamp,
          logo_url: logoUrl,
        }, { onConflict: "address" });

        if (tokenError) {
          console.error(`Error inserting ${address}:`, tokenError.message);
          errors.push(`${address}: ${tokenError.message}`);
          continue;
        }

        // Extract and insert stats if available
        const marketCap = parseFloat(coin.marketCap) || 0;
        const volume24h = parseFloat(coin.volume24h) || parseFloat(coin.volume) || 0;
        const uniqueHolders = coin.uniqueHolders || 0;
        const price = parseFloat(coin.tokenPrice?.priceInUsdc) || 0;
        const liquidity = parseFloat(coin.totalValueLocked) || 
                         parseFloat(coin.tvl) || 
                         parseFloat(coin.liquidity) || 0;

        await supabase.from("token_stats").upsert({
          token_address: address,
          price,
          price_change_24h: 0, // Will be calculated by fetch-prices from history
          volume_24h: volume24h,
          liquidity: liquidity > 0 ? liquidity : (marketCap > 0 ? marketCap * 0.1 : 0),
          liquidity_dex: liquidity > 0 ? liquidity : null,
          liquidity_estimated: marketCap > 0 ? marketCap * 0.1 : null,
          liquidity_source: liquidity > 0 ? 'dex' : (marketCap > 0 ? 'estimated' : null),
          market_cap: marketCap,
          holders: uniqueHolders,
        }, { onConflict: "token_address" });

        // Add provenance record (ignore duplicates)
        try {
          await supabase.from("token_provenance").insert({
            token_address: address,
            source: "zora_backfill",
            chain: "base",
            tx_hash: creationTxHash,
            block_number: creationBlock,
            log_index: creationLogIndex,
            factory_address: "0x777777751622c0d3258f214f9df38e35bf45baf3",
            detected_at: launchTimestamp,
            is_primary: true,
          });
        } catch {
          // Ignore duplicate errors
        }

        // Create creator profile if not exists
        if (creatorAddress) {
          const creatorProfile: any = { address: creatorAddress };
          
          if (coin.creatorProfile) {
            creatorProfile.display_name = coin.creatorProfile.displayName || 
                                         coin.creatorProfile.name ||
                                         coin.creatorProfile.username;
            creatorProfile.avatar_url = coin.creatorProfile.avatar || 
                                       coin.creatorProfile.avatarUrl ||
                                       coin.creatorProfile.pfp;
            creatorProfile.farcaster_handle = coin.creatorProfile.farcasterHandle ||
                                             coin.creatorProfile.farcaster?.username;
            creatorProfile.farcaster_fid = coin.creatorProfile.farcasterFid ||
                                          coin.creatorProfile.farcaster?.fid;
          }

          await supabase.from("creator_profiles").upsert(creatorProfile, { 
            onConflict: "address", 
            ignoreDuplicates: true 
          });
        }

        indexed++;
        console.log(`Indexed: ${symbol} (${address})`);

      } catch (err) {
        console.error(`Error processing coin:`, err);
        errors.push(String(err));
      }
    }

    // Trigger price fetch for newly indexed tokens to populate history
    if (indexed > 0) {
      const { data: newTokens } = await supabase
        .from("tokens")
        .select("address")
        .eq("source", "zora_backfill")
        .order("created_at", { ascending: false })
        .limit(indexed);

      if (newTokens && newTokens.length > 0) {
        const addresses = newTokens.map(t => t.address);
        console.log(`Triggering price fetch for ${addresses.length} backfilled tokens`);
        
        // Call fetch-prices function
        await supabase.functions.invoke("fetch-prices", {
          body: { tokenAddresses: addresses },
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      indexed,
      skipped,
      total: coins.length,
      nextCursor,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Backfill error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
