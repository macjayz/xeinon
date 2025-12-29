import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Zora Coins SDK REST API
const ZORA_API_URL = "https://api-sdk.zora.engineering/coin";
// DexScreener as fallback
const DEXSCREENER_API = "https://api.dexscreener.com/latest/dex/tokens";

interface TokenUpdate {
  address: string;
  logo_url?: string;
  creator_address?: string;
}

interface CreatorProfile {
  address: string;
  display_name?: string;
  avatar_url?: string;
  farcaster_handle?: string;
  farcaster_fid?: number;
}

// Rate-limited fetch with exponential backoff
async function fetchWithRetry(
  url: string, 
  headers: Record<string, string>, 
  maxRetries = 3
): Promise<Response | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, { headers });
      
      if (response.status === 429) {
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
        console.log(`Rate limited, waiting ${delay}ms before retry ${attempt + 1}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      return response;
    } catch (error) {
      console.error(`Fetch attempt ${attempt + 1} failed:`, error);
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  return null;
}

async function fetchCoinsFromZoraAPI(
  addresses: string[], 
  apiKey?: string
): Promise<{ stats: Record<string, any>; tokenUpdates: TokenUpdate[]; creators: CreatorProfile[] }> {
  const stats: Record<string, any> = {};
  const tokenUpdates: TokenUpdate[] = [];
  const creatorsMap: Map<string, CreatorProfile> = new Map();
  
  // Process in smaller batches with delays between batches
  const BATCH_SIZE = 5;
  const BATCH_DELAY = 500;
  
  console.log(`Fetching ${addresses.length} coins from Zora REST API in batches of ${BATCH_SIZE}`);
  
  for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
    const batch = addresses.slice(i, i + BATCH_SIZE);
    
    // Process batch in parallel
    const batchPromises = batch.map(async (address) => {
      try {
        const url = `${ZORA_API_URL}?address=${address}&chain=8453`;
        const headers: Record<string, string> = { Accept: "application/json" };
        if (apiKey) headers["api-key"] = apiKey;
        
        const response = await fetchWithRetry(url, headers);

        if (response?.ok) {
          const data = await response.json();
          const coin = data.zora20Token;

          if (coin) {
            const marketCap = parseFloat(coin.marketCap) || 0;
            const volume24h = parseFloat(coin.volume24h) || parseFloat(coin.volume) || 0;
            const uniqueHolders = coin.uniqueHolders || 0;
            const price = parseFloat(coin.tokenPrice?.priceInUsdc) || 0;
            
            // Calculate price change as percentage (signed)
            // Prefer direct % fields; otherwise derive from "24h-ago price" if present.
            let priceChange24h = 0;

            // 1) Dedicated percentage fields
            if (coin.priceChangePercent24h !== undefined && coin.priceChangePercent24h !== null) {
              priceChange24h = Number(coin.priceChangePercent24h) || 0;
            } else if (coin.tokenPrice?.priceChangePercent24h !== undefined && coin.tokenPrice?.priceChangePercent24h !== null) {
              priceChange24h = Number(coin.tokenPrice.priceChangePercent24h) || 0;
            }

            // 2) Derive from explicit 24h-ago price (more reliable for sign)
            if (priceChange24h === 0) {
              const price24hAgo =
                Number(coin.tokenPrice?.price24hAgoInUsdc) ||
                Number(coin.tokenPrice?.priceOneDayAgoInUsdc) ||
                Number(coin.tokenPrice?.price24HrAgoInUsdc) ||
                0;

              if (price24hAgo > 0 && price > 0) {
                priceChange24h = ((price - price24hAgo) / price24hAgo) * 100;
              }
            }

            // Note: we intentionally do NOT use marketCapDelta24h as it's an absolute value, not percentage.
            
            console.log(`Processing ${address}: marketCap=${marketCap}, volume=${volume24h}, holders=${uniqueHolders}, price=${price}, priceChange=${priceChange24h}`);
            
            // Try to get real liquidity from API first
            const realLiquidity = parseFloat(coin.totalValueLocked) || 
                                 parseFloat(coin.tvl) ||
                                 parseFloat(coin.poolBalance) ||
                                 parseFloat(coin.liquidity) || 
                                 parseFloat(coin.poolLiquidity) || 0;
            
            // Estimate bonding curve liquidity if no real data (~10% of market cap)
            const estimatedLiquidity = marketCap > 0 ? marketCap * 0.1 : 0;
            
            // Total liquidity and source tracking
            const liquidity = realLiquidity > 0 ? realLiquidity : estimatedLiquidity;
            const liquiditySource = realLiquidity > 0 ? 'dex' : (estimatedLiquidity > 0 ? 'estimated' : null);

            stats[address.toLowerCase()] = {
              token_address: address.toLowerCase(),
              price,
              price_change_24h: priceChange24h,
              volume_24h: volume24h,
              liquidity,
              liquidity_dex: realLiquidity > 0 ? realLiquidity : null,
              liquidity_estimated: estimatedLiquidity > 0 ? estimatedLiquidity : null,
              liquidity_source: liquiditySource,
              market_cap: marketCap,
              holders: uniqueHolders,
            };

            // Extract logo URL from mediaContent
            const logoUrl = coin.mediaContent?.previewImage?.medium || 
                           coin.mediaContent?.previewImage?.small ||
                           coin.mediaContent?.originalUri ||
                           coin.image ||
                           coin.imageUrl;

            // Extract creator address
            const creatorAddress = coin.creatorAddress || coin.creator || coin.deployer;

            if (logoUrl || creatorAddress) {
              tokenUpdates.push({
                address: address.toLowerCase(),
                logo_url: logoUrl,
                creator_address: creatorAddress?.toLowerCase(),
              });
            }

            // Build creator profile if we have creator data
            if (creatorAddress) {
              const creatorLower = creatorAddress.toLowerCase();
              if (!creatorsMap.has(creatorLower)) {
                const creatorProfile: CreatorProfile = {
                  address: creatorLower,
                };

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

                creatorsMap.set(creatorLower, creatorProfile);
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error fetching Zora API for ${address}:`, error);
      }
    });
    
    await Promise.all(batchPromises);
    
    // Delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < addresses.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
    }
  }

  console.log(`Zora API returned data for ${Object.keys(stats).length} tokens`);
  return { stats, tokenUpdates, creators: Array.from(creatorsMap.values()) };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const ZORA_API_KEY = Deno.env.get("ZORA_API_KEY");

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const { tokenAddresses } = await req.json();

    console.log(`Fetching prices for ${tokenAddresses?.length || 0} tokens`);

    if (!tokenAddresses || tokenAddresses.length === 0) {
      return new Response(JSON.stringify({ success: true, updated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Limit batch size to avoid timeout
    const MAX_TOKENS = 50;
    const tokensToProcess = tokenAddresses.slice(0, MAX_TOKENS);
    
    if (tokenAddresses.length > MAX_TOKENS) {
      console.log(`Processing only first ${MAX_TOKENS} of ${tokenAddresses.length} tokens`);
    }

    // Fetch from Zora REST API
    const { stats, tokenUpdates, creators } = await fetchCoinsFromZoraAPI(tokensToProcess, ZORA_API_KEY);

    // Get tokens that weren't found in Zora API
    const missingTokens = tokensToProcess.filter((addr: string) => !stats[addr.toLowerCase()]);

    // Try DexScreener for missing tokens (in batches)
    if (missingTokens.length > 0) {
      console.log(`Fetching ${missingTokens.length} tokens from DexScreener`);

      const batchSize = 30;
      for (let i = 0; i < missingTokens.length; i += batchSize) {
        const batch = missingTokens.slice(i, i + batchSize);
        const addressList = batch.join(",");

        try {
          const response = await fetch(`${DEXSCREENER_API}/${addressList}`);
          const data = await response.json();

          if (data.pairs && Array.isArray(data.pairs)) {
            const tokenPairs: Record<string, any> = {};

            for (const pair of data.pairs) {
              const tokenAddress = pair.baseToken?.address?.toLowerCase();
              if (!tokenAddress) continue;

              if (
                !tokenPairs[tokenAddress] ||
                (pair.liquidity?.usd || 0) > (tokenPairs[tokenAddress].liquidity?.usd || 0)
              ) {
                tokenPairs[tokenAddress] = pair;
              }
            }

            for (const [tokenAddress, pair] of Object.entries(tokenPairs)) {
              if (!stats[tokenAddress]) {
                const dexLiquidity = pair.liquidity?.usd || 0;
                // DexScreener provides actual percentage change
                const priceChange = parseFloat(pair.priceChange?.h24) || 0;
                
                stats[tokenAddress] = {
                  token_address: tokenAddress,
                  price: parseFloat(pair.priceUsd) || 0,
                  price_change_24h: priceChange,
                  volume_24h: pair.volume?.h24 || 0,
                  liquidity: dexLiquidity,
                  liquidity_dex: dexLiquidity > 0 ? dexLiquidity : null,
                  liquidity_estimated: null,
                  liquidity_source: dexLiquidity > 0 ? 'dex' : null,
                  market_cap: pair.fdv || 0,
                  holders: 0,
                };

                if (pair.info?.imageUrl) {
                  tokenUpdates.push({
                    address: tokenAddress,
                    logo_url: pair.info.imageUrl,
                  });
                }
              }
            }
          }

          if (i + batchSize < missingTokens.length) {
            await new Promise((resolve) => setTimeout(resolve, 300));
          }
        } catch (batchError) {
          console.error(`Error fetching DexScreener batch:`, batchError);
        }
      }
    }

    // Add zeros for tokens not found anywhere
    for (const addr of tokensToProcess) {
      const lowerAddr = addr.toLowerCase();
      if (!stats[lowerAddr]) {
        stats[lowerAddr] = {
          token_address: lowerAddr,
          price: 0,
          price_change_24h: 0,
          volume_24h: 0,
          liquidity: 0,
          liquidity_dex: null,
          liquidity_estimated: null,
          liquidity_source: null,
          market_cap: 0,
          holders: 0,
        };
      }
    }

    // Update token_stats
    const requestedAddresses = new Set(tokensToProcess.map((a: string) => a.toLowerCase()));
    const filteredStats = Object.values(stats).filter((s: any) => requestedAddresses.has(s.token_address));

    // Calculate price_change_24h from our own token_history table
    // Prefer: compare current price vs the oldest recorded price within the last 24h.
    // This yields signed % even if we don’t have data older than 24h.
    const cutoffIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    await Promise.all(
      filteredStats.map(async (s: any) => {
        const currentPrice = Number(s.price) || 0;
        if (currentPrice <= 0) return;

        // Get the oldest price sample within last 24h (closest to 24h ago)
        const { data: baseline, error: baselineErr } = await supabase
          .from('token_history')
          .select('price,timestamp')
          .eq('token_address', s.token_address)
          .gte('timestamp', cutoffIso)
          .order('timestamp', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (baselineErr) {
          console.error('Error fetching baseline price for', s.token_address, baselineErr);
          return;
        }

        const baselinePrice = Number(baseline?.price) || 0;

        // If we have a usable baseline, compute signed % change
        if (baselinePrice > 0) {
          s.price_change_24h = ((currentPrice - baselinePrice) / baselinePrice) * 100;
          console.log(
            `${s.token_address}: baseline=${baselinePrice}, current=${currentPrice}, change=${Number(s.price_change_24h).toFixed(2)}%`
          );
        }
        // Else: keep whatever the upstream API provided (may be 0 if unknown)
      })
    );

    if (filteredStats.length > 0) {
      const { error } = await supabase.from("token_stats").upsert(filteredStats, { onConflict: "token_address" });
      if (error) {
        console.error("Error upserting stats:", error);
      } else {
        console.log(`Updated stats for ${filteredStats.length} tokens`);
      }

      // Update token_stage based on stats data (backend-owned lifecycle)
      const stageUpdates = filteredStats.map(async (s: any) => {
        let newStage: string | null = null;
        
        if (s.volume_24h > 0) {
          newStage = 'traded';
        } else if (s.liquidity > 0) {
          newStage = 'liquid';
        } else if (s.price > 0) {
          newStage = 'priced';
        } else if (s.holders > 0) {
          newStage = 'discovered';
        }
        
        if (newStage) {
          const stageOrder = { created: 0, discovered: 1, priced: 2, liquid: 3, traded: 4, dead: 5 };
          await supabase
            .from("tokens")
            .update({ token_stage: newStage })
            .eq("address", s.token_address)
            .in("token_stage", Object.keys(stageOrder).filter(k => stageOrder[k as keyof typeof stageOrder] < stageOrder[newStage as keyof typeof stageOrder]));
        }
      });
      await Promise.all(stageUpdates);

      // Add to history (only tokens with actual data)
      const historyRecords = filteredStats
        .filter((s: any) => s.price > 0 || s.volume_24h > 0 || s.market_cap > 0)
        .map((s: any) => ({
          token_address: s.token_address,
          price: s.price,
          volume: s.volume_24h,
          liquidity: s.liquidity,
          holders: s.holders,
        }));

      if (historyRecords.length > 0) {
        await supabase.from("token_history").insert(historyRecords);
      }
    }

    // Batch update token logos and creator addresses
    if (tokenUpdates.length > 0) {
      console.log(`Updating ${tokenUpdates.length} tokens with logos/creators`);
      
      await Promise.all(
        tokenUpdates.map(async (update) => {
          const updateData: any = {};
          if (update.logo_url) updateData.logo_url = update.logo_url;
          if (update.creator_address) updateData.creator_address = update.creator_address;
          
          if (Object.keys(updateData).length > 0) {
            await supabase
              .from("tokens")
              .update(updateData)
              .eq("address", update.address);
          }
        })
      );
    }

    // Upsert creator profiles
    if (creators.length > 0) {
      console.log(`Upserting ${creators.length} creator profiles`);
      const { error } = await supabase
        .from("creator_profiles")
        .upsert(creators, { onConflict: "address", ignoreDuplicates: false });
      
      if (error) {
        console.error("Error upserting creator profiles:", error);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      updated: filteredStats.length,
      logos: tokenUpdates.length,
      creators: creators.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in fetch-prices function:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
