import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Zora CoinCreated event signature
const COIN_CREATED_TOPIC_PREFIX = '0x2de43610';

// Factory address - Zora Coins Factory on Base
const ZORA_FACTORY = '0x777777751622c0d3258f214f9df38e35bf45baf3';

// Helper to decode ABI-encoded string from data
function decodeString(data: string, offset: number): string {
  try {
    const stringOffset = parseInt(data.slice(offset, offset + 64), 16) * 2;
    const stringLength = parseInt(data.slice(stringOffset, stringOffset + 64), 16);
    const stringData = data.slice(stringOffset + 64, stringOffset + 64 + stringLength * 2);
    let result = '';
    for (let i = 0; i < stringData.length; i += 2) {
      result += String.fromCharCode(parseInt(stringData.slice(i, i + 2), 16));
    }
    return result;
  } catch {
    return '';
  }
}

// Helper to decode address from data
function decodeAddress(data: string, offset: number): string {
  return '0x' + data.slice(offset + 24, offset + 64).toLowerCase();
}

serve(async (req) => {
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  // Handle regular HTTP requests
  if (upgradeHeader.toLowerCase() !== "websocket") {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ 
      message: 'WebSocket endpoint for real-time token indexing',
      usage: 'Connect via WebSocket to receive real-time token updates'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Upgrade to WebSocket
  const { socket, response } = Deno.upgradeWebSocket(req);

  const ALCHEMY_API_KEY = Deno.env.get('ALCHEMY_API_KEY');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

  let alchemyWs: WebSocket | null = null;

  socket.onopen = () => {
    console.log('Client connected to realtime indexer');

    const alchemyWsUrl = `wss://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
    alchemyWs = new WebSocket(alchemyWsUrl);

    alchemyWs.onopen = () => {
      console.log('Connected to Alchemy WebSocket');

      // Subscribe to ALL logs from Zora factory
      alchemyWs!.send(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_subscribe',
        params: ['logs', { address: ZORA_FACTORY }]
      }));

      // Subscribe to new blocks
      alchemyWs!.send(JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'eth_subscribe',
        params: ['newHeads']
      }));

      socket.send(JSON.stringify({ type: 'connected', message: 'Listening for new Zora coins on Base' }));
    };

    alchemyWs.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle subscription confirmation
        if (data.result && typeof data.result === 'string' && data.id) {
          console.log(`Subscription ${data.id} confirmed:`, data.result);
          socket.send(JSON.stringify({ type: 'subscription_confirmed', id: data.id, subscriptionId: data.result }));
          return;
        }

        if (data.method === 'eth_subscription' && data.params?.result) {
          const result = data.params.result;

          // Check if this is a log event with topics (potential CoinCreated)
          if (result.topics && result.topics.length > 0 && result.data) {
            const eventSig = result.topics[0]?.toLowerCase();
            
            console.log('📜 Factory event detected:', eventSig?.slice(0, 20) + '...');
            
            if (eventSig && eventSig.startsWith(COIN_CREATED_TOPIC_PREFIX)) {
              console.log('🚀 CoinCreated event! TX:', result.transactionHash);
              
              const rawData = result.data.slice(2);
              const creatorAddress = result.topics[1] 
                ? '0x' + result.topics[1].slice(26).toLowerCase()
                : null;
              
              const coinAddress = decodeAddress(rawData, 64 * 4);
              const name = decodeString(rawData, 64 * 1);
              const symbol = decodeString(rawData, 64 * 3);
              
              const blockNumber = result.blockNumber ? parseInt(result.blockNumber, 16) : null;
              const logIndex = result.logIndex ? parseInt(result.logIndex, 16) : null;
              
              console.log('Parsed - Coin:', coinAddress, 'Name:', name, 'Symbol:', symbol, 'Creator:', creatorAddress);
              
              if (coinAddress && coinAddress.length === 42 && coinAddress !== '0x0000000000000000000000000000000000000000') {
                
                // STEP 1: Write to token_detections (raw intake layer)
                const detection = {
                  chain: 'base',
                  address: coinAddress.toLowerCase(),
                  source: 'zora_ws',
                  tx_hash: result.transactionHash || null,
                  block_number: blockNumber,
                  log_index: logIndex,
                  factory_address: ZORA_FACTORY,
                  processed: false,
                  raw_data: { name, symbol, creator: creatorAddress, topics: result.topics }
                };
                
                const { error: detectionError } = await supabase
                  .from('token_detections')
                  .insert(detection);
                
                if (detectionError) {
                  console.error('Error inserting detection:', detectionError);
                }
                
                // STEP 2: Fetch additional metadata
                const metadataResponse = await fetch(`https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'alchemy_getTokenMetadata',
                    params: [coinAddress]
                  })
                });

                const metadata = await metadataResponse.json();
                const tokenName = metadata.result?.name || name || 'New Zora Coin';
                const tokenSymbol = metadata.result?.symbol || symbol || 'COIN';
                const tokenLogo = metadata.result?.logo || null;
                
                // STEP 3: Check if token already exists
                const { data: existingToken } = await supabase
                  .from('tokens')
                  .select('address, token_stage')
                  .eq('address', coinAddress.toLowerCase())
                  .maybeSingle();
                
                // STEP 4: Insert/update canonical tokens table
                const newToken = {
                  address: coinAddress.toLowerCase(),
                  chain: 'base',
                  name: tokenName,
                  symbol: tokenSymbol,
                  decimals: metadata.result?.decimals || 18,
                  logo_url: tokenLogo,
                  platform: 'Zora' as const,
                  factory_address: ZORA_FACTORY,
                  creator_address: creatorAddress,
                  source: 'zora_ws',
                  token_stage: 'created',
                  first_seen_at: new Date().toISOString(),
                  launch_timestamp: new Date().toISOString(),
                  creation_tx_hash: result.transactionHash || null,
                  creation_block: blockNumber,
                  creation_log_index: logIndex,
                };

                const { data: insertedToken, error: insertError } = await supabase
                  .from('tokens')
                  .upsert(newToken, { onConflict: 'address' })
                  .select()
                  .single();

                if (insertError) {
                  console.error('Error inserting token:', insertError);
                } else {
                  // STEP 5: Add provenance record
                  const provenance = {
                    token_address: coinAddress.toLowerCase(),
                    chain: 'base',
                    source: 'zora_ws',
                    tx_hash: result.transactionHash || null,
                    block_number: blockNumber,
                    log_index: logIndex,
                    factory_address: ZORA_FACTORY,
                    is_primary: !existingToken, // First discovery = primary
                    metadata: { name: tokenName, symbol: tokenSymbol, creator: creatorAddress }
                  };
                  
                  await supabase
                    .from('token_provenance')
                    .upsert(provenance, { 
                      onConflict: 'token_address,chain,source,tx_hash',
                      ignoreDuplicates: true 
                    });
                  
                  // STEP 6: Upgrade to 'discovered' after metadata fetch
                  await supabase
                    .from('tokens')
                    .update({ token_stage: 'discovered' })
                    .eq('address', coinAddress.toLowerCase())
                    .eq('token_stage', 'created');
                  
                  // STEP 7: Mark detection as processed
                  await supabase
                    .from('token_detections')
                    .update({ processed: true })
                    .eq('address', coinAddress.toLowerCase())
                    .eq('tx_hash', result.transactionHash);
                  
                  // STEP 8: Fetch and insert token stats
                  let tokenStats = {
                    token_address: coinAddress.toLowerCase(),
                    price: 0,
                    price_change_24h: 0,
                    volume_24h: 0,
                    liquidity: 0,
                    holders: 0,
                    market_cap: 0,
                  };

                  try {
                    const dexResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${coinAddress}`);
                    const dexData = await dexResponse.json();
                    
                    if (dexData.pairs && dexData.pairs.length > 0) {
                      const bestPair = dexData.pairs.reduce((best: any, pair: any) => 
                        (pair.liquidity?.usd || 0) > (best.liquidity?.usd || 0) ? pair : best
                      , dexData.pairs[0]);
                      
                      tokenStats = {
                        token_address: coinAddress.toLowerCase(),
                        price: parseFloat(bestPair.priceUsd) || 0,
                        price_change_24h: bestPair.priceChange?.h24 || 0,
                        volume_24h: bestPair.volume?.h24 || 0,
                        liquidity: bestPair.liquidity?.usd || 0,
                        holders: 0,
                        market_cap: bestPair.fdv || 0,
                      };
                      console.log('📊 Got DexScreener data:', JSON.stringify(tokenStats));
                    }
                  } catch (dexError) {
                    console.log('DexScreener not available yet for new token:', coinAddress);
                  }

                  await supabase.from('token_stats').upsert(tokenStats, { onConflict: 'token_address' });

                  // STEP 9: Create creator profile
                  if (creatorAddress) {
                    const creatorProfile = {
                      address: creatorAddress,
                      display_name: null,
                      avatar_url: `https://api.dicebear.com/7.x/identicon/svg?seed=${creatorAddress}`,
                    };
                    
                    await supabase
                      .from('creator_profiles')
                      .upsert(creatorProfile, { onConflict: 'address', ignoreDuplicates: true });
                  }

                  // Send to connected client
                  socket.send(JSON.stringify({
                    type: 'new_token',
                    token: { ...insertedToken, stats: tokenStats },
                  }));

                  console.log('✅ Token indexed with provenance:', tokenSymbol, coinAddress);
                }
              }
            }
          }

          // Handle new block
          if (result.number) {
            const blockNumber = parseInt(result.number, 16);
            socket.send(JSON.stringify({
              type: 'new_block',
              blockNumber,
            }));
          }
        }
      } catch (error) {
        console.error('Error processing Alchemy event:', error);
        socket.send(JSON.stringify({ type: 'error', message: String(error) }));
      }
    };

    alchemyWs.onerror = (error) => {
      console.error('Alchemy WebSocket error:', error);
      socket.send(JSON.stringify({ type: 'error', message: 'Blockchain connection error' }));
    };

    alchemyWs.onclose = () => {
      console.log('Alchemy WebSocket closed');
      socket.send(JSON.stringify({ type: 'disconnected', message: 'Blockchain connection closed' }));
    };
  };

  socket.onmessage = (event) => {
    console.log('Client message:', event.data);
    try {
      const message = JSON.parse(event.data);

      if (message.type === 'ping') {
        socket.send(JSON.stringify({ type: 'pong' }));
      }
    } catch (error) {
      console.error('Error parsing client message:', error);
    }
  };

  socket.onclose = () => {
    console.log('Client disconnected');
    if (alchemyWs) {
      alchemyWs.close();
    }
  };

  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  return response;
});
