import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Known factory addresses on Base
const KNOWN_FACTORIES = {
  zora: '0x777777751622c0d3258f214f9df38e35bf45baf3',
  // Future: add Clanker, Flaunch, Mint Club factories here
};

// CoinCreated event signature (keccak256 hash)
// Event: CoinCreated(address indexed creator, address indexed coin, string uri, string symbol, ...)
const COIN_CREATED_TOPIC = '0x2de436107c2096e039a3e5173c20a02b2af10fbcb7f81c7f86a2d99ae74c8bff';

// Check if bytecode contains ERC-20 selectors
async function matchFingerprint(
  bytecode: string, 
  supabase: any
): Promise<{ matched: boolean; fingerprint: string | null; confidence: number }> {
  if (!bytecode || bytecode === '0x') return { matched: false, fingerprint: null, confidence: 0 };
  
  const code = bytecode.toLowerCase();
  
  // Fetch fingerprints from database
  const { data: fingerprints } = await supabase
    .from('bytecode_fingerprints')
    .select('*')
    .eq('is_active', true)
    .order('confidence', { ascending: false });
  
  if (!fingerprints || fingerprints.length === 0) {
    // Fallback to hardcoded check if no fingerprints in DB
    const coreSelectors = ['06fdde03', '95d89b41', '70a08231', 'a9059cbb'];
    let matches = 0;
    for (const sel of coreSelectors) {
      if (code.includes(sel)) matches++;
    }
    return { matched: matches >= 3, fingerprint: 'erc20_fallback', confidence: matches * 25 };
  }
  
  // Check against each fingerprint
  for (const fp of fingerprints) {
    let matches = 0;
    for (const selector of fp.selectors) {
      if (code.includes(selector)) matches++;
    }
    
    const matchRatio = matches / fp.selectors.length;
    if (matchRatio >= 0.75) { // 75% of selectors must match
      return { matched: true, fingerprint: fp.fingerprint_id, confidence: fp.confidence };
    }
  }
  
  return { matched: false, fingerprint: null, confidence: 0 };
}

// Compute simple code hash for deduplication
function computeCodeHash(bytecode: string): string {
  if (!bytecode || bytecode.length < 20) return 'invalid';
  return `${bytecode.slice(2, 10)}_${bytecode.slice(-8)}_${bytecode.length}`;
}

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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('🔍 Starting bytecode scan safety net...');

  try {
    const ALCHEMY_API_KEY = Deno.env.get('ALCHEMY_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!ALCHEMY_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const alchemyUrl = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

    // Get current block number
    const blockResponse = await fetch(alchemyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_blockNumber',
        params: []
      })
    });
    
    const blockData = await blockResponse.json();
    const currentBlock = parseInt(blockData.result, 16);
    const fromBlock = currentBlock - 100; // ~3-4 minutes on Base (increased range)
    
    console.log(`📦 Scanning blocks ${fromBlock} to ${currentBlock}`);

    const detections: any[] = [];
    
    // STEP 1: Check known factories for CoinCreated events with proper event topic filter
    for (const [platform, factoryAddress] of Object.entries(KNOWN_FACTORIES)) {
      console.log(`🏭 Checking ${platform} factory: ${factoryAddress}`);
      
      const logsResponse = await fetch(alchemyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getLogs',
          params: [{
            fromBlock: '0x' + fromBlock.toString(16),
            toBlock: '0x' + currentBlock.toString(16),
            address: factoryAddress,
            topics: [COIN_CREATED_TOPIC] // Filter by CoinCreated event signature
          }]
        })
      });
      
      const logsData = await logsResponse.json();
      const logs = logsData.result || [];
      
      console.log(`📜 Found ${logs.length} CoinCreated events from ${platform} factory`);
      
      for (const log of logs) {
        if (!log.data || log.data.length < 66) continue;
        
        const rawData = log.data.slice(2);
        const creatorAddress = log.topics[1] 
          ? '0x' + log.topics[1].slice(26).toLowerCase()
          : null;
        
        // Decode coin address from event data (4th parameter at offset 64*4)
        const coinAddress = decodeAddress(rawData, 64 * 4);
        const name = decodeString(rawData, 64 * 1);
        const symbol = decodeString(rawData, 64 * 3);
        
        console.log(`🪙 CoinCreated: ${coinAddress} (${symbol}) by ${creatorAddress}`);
        
        if (coinAddress && coinAddress.length === 42 && 
            coinAddress !== '0x0000000000000000000000000000000000000000') {
          
          detections.push({
            chain: 'base',
            address: coinAddress,
            source: 'bytecode_scan',
            tx_hash: log.transactionHash,
            block_number: parseInt(log.blockNumber, 16),
            log_index: parseInt(log.logIndex, 16),
            factory_address: factoryAddress,
            raw_data: { platform, name, symbol, creator: creatorAddress, log_topic: log.topics?.[0] }
          });
        }
      }
    }

    // STEP 2: Scan for any contract creations with ERC-20 bytecode (catch non-factory tokens)
    const tracesResponse = await fetch(alchemyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'alchemy_getAssetTransfers',
        params: [{
          fromBlock: '0x' + fromBlock.toString(16),
          toBlock: '0x' + currentBlock.toString(16),
          category: ['external'],
          excludeZeroValue: true,
          maxCount: '0x64', // 100 max
        }]
      })
    });
    
    const tracesData = await tracesResponse.json();
    const transfers = tracesData.result?.transfers || [];
    
    // Filter for contract creations (to address is null or newly created contract)
    const creations = transfers.filter((t: any) => 
      !t.to && t.rawContract?.address
    );
    
    console.log(`🔧 Found ${creations.length} potential contract creations in range`);
    
    for (const creation of creations.slice(0, 20)) {
      const contractAddress = creation.rawContract?.address?.toLowerCase();
      if (!contractAddress) continue;
      
      // Skip if already detected via factory
      if (detections.some(d => d.address === contractAddress)) continue;
      
      // Get bytecode
      const codeResponse = await fetch(alchemyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getCode',
          params: [contractAddress, 'latest']
        })
      });
      
      const codeData = await codeResponse.json();
      const bytecode = codeData.result;
      
      const { matched, fingerprint, confidence } = await matchFingerprint(bytecode, supabase);
      
      if (matched) {
        console.log(`🪙 ERC-20-like contract found: ${contractAddress} (${fingerprint}, ${confidence}%)`);
        detections.push({
          chain: 'base',
          address: contractAddress,
          source: 'bytecode_scan',
          tx_hash: creation.hash,
          block_number: parseInt(creation.blockNum, 16),
          log_index: null,
          factory_address: null,
          code_hash: computeCodeHash(bytecode),
          matched_fingerprint: fingerprint,
          raw_data: { confidence, bytecode_length: bytecode?.length }
        });
      }
    }

    console.log(`📊 Found ${detections.length} potential detections`);

    // STEP 3: Insert all detections into token_detections (raw intake)
    if (detections.length > 0) {
      const { error: detectError } = await supabase
        .from('token_detections')
        .insert(detections.map(d => ({ ...d, processed: false })));
      
      if (detectError) {
        console.error('Error inserting detections:', detectError);
      }
    }

    // STEP 4: Process detections into canonical tokens
    let indexed = 0;
    for (const detection of detections) {
      try {
        // Check if token already exists
        const { data: existingToken } = await supabase
          .from('tokens')
          .select('address, token_stage')
          .eq('address', detection.address)
          .maybeSingle();
        
        if (existingToken) {
          // Token exists - just add provenance record
          await supabase
            .from('token_provenance')
            .upsert({
              token_address: detection.address,
              chain: 'base',
              source: 'bytecode_scan',
              tx_hash: detection.tx_hash,
              block_number: detection.block_number,
              log_index: detection.log_index,
              factory_address: detection.factory_address,
              is_primary: false, // Not first discovery
              metadata: { matched_fingerprint: detection.matched_fingerprint }
            }, { 
              onConflict: 'token_address,chain,source,tx_hash',
              ignoreDuplicates: true 
            });
          
          console.log(`📝 Added provenance for existing token: ${detection.address}`);
          continue;
        }
        
        // Get token metadata from Alchemy
        const metaResponse = await fetch(alchemyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'alchemy_getTokenMetadata',
            params: [detection.address]
          })
        });
        
        const metaData = await metaResponse.json();
        const metadata = metaData.result || {};
        
        // Use data from event if available, fall back to metadata
        const rawEventData = detection.raw_data || {};
        const tokenName = rawEventData.name || metadata.name || 'Unknown Token';
        const tokenSymbol = rawEventData.symbol || metadata.symbol || 'UNK';
        const creatorAddress = rawEventData.creator || null;
        
        if (!tokenName && !tokenSymbol) {
          console.log(`⏭️ Skipping ${detection.address} - no metadata`);
          continue;
        }
        
        // Insert new token
        const newToken = {
          address: detection.address,
          chain: 'base',
          name: tokenName,
          symbol: tokenSymbol,
          decimals: metadata.decimals || 18,
          logo_url: metadata.logo || null,
          platform: detection.factory_address === KNOWN_FACTORIES.zora ? 'Zora' : 'Custom',
          factory_address: detection.factory_address,
          creator_address: creatorAddress,
          first_seen_at: new Date().toISOString(),
          launch_timestamp: new Date().toISOString(),
          source: 'bytecode_scan',
          token_stage: 'discovered',
          creation_tx_hash: detection.tx_hash,
          creation_block: detection.block_number,
          creation_log_index: detection.log_index,
        };
        
        const { error: insertError } = await supabase
          .from('tokens')
          .insert(newToken);
        
        if (insertError) {
          console.error(`❌ Error inserting ${detection.address}:`, insertError);
          continue;
        }
        
        // Add primary provenance record
        await supabase
          .from('token_provenance')
          .insert({
            token_address: detection.address,
            chain: 'base',
            source: 'bytecode_scan',
            tx_hash: detection.tx_hash,
            block_number: detection.block_number,
            log_index: detection.log_index,
            factory_address: detection.factory_address,
            is_primary: true,
            metadata: { matched_fingerprint: detection.matched_fingerprint, name: tokenName, symbol: tokenSymbol }
          });
        
        // Insert initial stats
        await supabase.from('token_stats').upsert({
          token_address: detection.address,
          price: 0,
          price_change_24h: 0,
          volume_24h: 0,
          liquidity: 0,
          holders: 0,
          market_cap: 0,
        }, { onConflict: 'token_address' });
        
        // Create creator profile if available
        if (creatorAddress) {
          await supabase
            .from('creator_profiles')
            .upsert({
              address: creatorAddress,
              avatar_url: `https://api.dicebear.com/7.x/identicon/svg?seed=${creatorAddress}`,
            }, { onConflict: 'address', ignoreDuplicates: true });
        }
        
        // Mark detection as processed
        await supabase
          .from('token_detections')
          .update({ processed: true })
          .eq('address', detection.address)
          .eq('tx_hash', detection.tx_hash);
        
        console.log(`✅ Indexed: ${tokenSymbol} (${detection.address})`);
        indexed++;
        
      } catch (err) {
        console.error(`❌ Error processing ${detection.address}:`, err);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`🏁 Bytecode scan complete: ${indexed} tokens indexed in ${duration}ms`);

    return new Response(JSON.stringify({
      success: true,
      scannedBlocks: currentBlock - fromBlock,
      detections: detections.length,
      indexed,
      durationMs: duration,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('❌ Bytecode scan error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
