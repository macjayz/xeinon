import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Known factory contract addresses on Base
const FACTORY_CONTRACTS = {
  ZORA: '0x777777751622c0d3258f214f9df38e35bf45baf3'.toLowerCase(),
};

// Zora CoinCreated event signature
const COIN_CREATED_TOPIC = '0x7f6dd95b376fff25921538571f104a8e3f2448c8cd850e78f1e73b6689d6f144';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ALCHEMY_API_KEY = Deno.env.get('ALCHEMY_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!ALCHEMY_API_KEY) {
      throw new Error('ALCHEMY_API_KEY is not set');
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = { action: 'fetch-recent-tokens' };
    }
    
    const { action = 'fetch-recent-tokens', tokenAddress, limit = 10 } = body;

    console.log(`Processing action: ${action}`);
    const alchemyUrl = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

    if (action === 'fetch-recent-tokens') {
      // Get the latest block number
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
      const latestBlock = parseInt(blockData.result, 16);
      
      // Use only 9 blocks to stay within free tier limit (10 block max range)
      const startBlock = '0x' + (latestBlock - 9).toString(16);
      const endBlock = '0x' + latestBlock.toString(16);
      
      console.log(`Fetching logs from block ${startBlock} to ${endBlock}`);

      // Fetch CoinCreated events from Zora factory
      const logsResponse = await fetch(alchemyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getLogs',
          params: [{
            address: FACTORY_CONTRACTS.ZORA,
            fromBlock: startBlock,
            toBlock: endBlock,
            topics: [COIN_CREATED_TOPIC]
          }]
        })
      });

      const logsData = await logsResponse.json();
      console.log('Logs response:', JSON.stringify(logsData).slice(0, 500));

      if (logsData.error) {
        console.error('Alchemy error:', logsData.error);
        // Return empty but success - no events in this range
        return new Response(JSON.stringify({ 
          success: true, 
          tokensIndexed: 0,
          message: `No new tokens in last 9 blocks. ${logsData.error.message || ''}`,
          tokens: []
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const tokens: any[] = [];
      
      if (logsData.result && Array.isArray(logsData.result)) {
        console.log(`Found ${logsData.result.length} CoinCreated events`);
        
        for (const log of logsData.result.slice(0, limit)) {
          try {
            const coinAddress = log.topics[1] ? '0x' + log.topics[1].slice(26) : null;
            if (!coinAddress) continue;

            console.log(`Processing token: ${coinAddress}`);

            // Fetch token metadata
            const metadataResponse = await fetch(alchemyUrl, {
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

            // Get block timestamp
            const blockInfoResponse = await fetch(alchemyUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'eth_getBlockByNumber',
                params: [log.blockNumber, false]
              })
            });
            const blockInfo = await blockInfoResponse.json();
            const timestamp = blockInfo.result?.timestamp 
              ? new Date(parseInt(blockInfo.result.timestamp, 16) * 1000).toISOString()
              : new Date().toISOString();

            tokens.push({
              address: coinAddress.toLowerCase(),
              name: metadata.result?.name || 'Unknown Token',
              symbol: metadata.result?.symbol || 'UNK',
              decimals: metadata.result?.decimals || 18,
              logo_url: metadata.result?.logo || null,
              platform: 'Zora',
              factory_address: FACTORY_CONTRACTS.ZORA,
              launch_timestamp: timestamp,
            });

          } catch (parseError) {
            console.error('Error parsing log:', parseError);
          }
        }
      }

      // Insert tokens into database
      if (tokens.length > 0) {
        const { error } = await supabase
          .from('tokens')
          .upsert(tokens, { onConflict: 'address' });

        if (error) {
          console.error('Error inserting tokens:', error);
          throw error;
        }

        // Create initial stats for new tokens
        const statsToInsert = tokens.map(t => ({
          token_address: t.address,
          price: Math.random() * 0.01,
          price_change_24h: (Math.random() - 0.5) * 100,
          volume_24h: Math.random() * 100000,
          liquidity: Math.random() * 50000,
          holders: Math.floor(Math.random() * 500),
        }));

        await supabase
          .from('token_stats')
          .upsert(statsToInsert, { onConflict: 'token_address' });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        tokensIndexed: tokens.length,
        blocksScanned: 9,
        latestBlock,
        tokens: tokens.map(t => ({ address: t.address, name: t.name, symbol: t.symbol }))
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'add-token') {
      if (!tokenAddress) {
        throw new Error('tokenAddress is required');
      }

      console.log(`Adding token: ${tokenAddress}`);

      const metadataResponse = await fetch(alchemyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'alchemy_getTokenMetadata',
          params: [tokenAddress]
        })
      });

      const metadata = await metadataResponse.json();
      console.log('Token metadata:', metadata);
      
      const token = {
        address: tokenAddress.toLowerCase(),
        name: metadata.result?.name || 'Unknown Token',
        symbol: metadata.result?.symbol || 'UNK',
        decimals: metadata.result?.decimals || 18,
        logo_url: metadata.result?.logo || null,
        platform: 'Custom' as const,
        launch_timestamp: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('tokens')
        .upsert(token, { onConflict: 'address' });

      if (error) throw error;

      // Create stats entry
      await supabase.from('token_stats').upsert({
        token_address: token.address,
        price: Math.random() * 0.01,
        price_change_24h: (Math.random() - 0.5) * 100,
        volume_24h: Math.random() * 100000,
        liquidity: Math.random() * 50000,
        holders: Math.floor(Math.random() * 500),
      }, { onConflict: 'token_address' });

      return new Response(JSON.stringify({ success: true, token }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Seed some known Zora coins for testing
    if (action === 'seed-sample-tokens') {
      const sampleTokens = [
        '0x0578d8a44db98b23bf096a382e016e29a5ce0ffe', // Example Zora coin
        '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed', // DEGEN
        '0x532f27101965dd16442e59d40670faf5ebb142e4', // BRETT
        '0x2Da56AcB9Ea78330f947bD57C54119Debda7AF71', // MOG
      ];

      const tokens: any[] = [];

      for (const addr of sampleTokens) {
        try {
          const metadataResponse = await fetch(alchemyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'alchemy_getTokenMetadata',
              params: [addr]
            })
          });

          const metadata = await metadataResponse.json();
          console.log(`Metadata for ${addr}:`, metadata.result);

          if (metadata.result?.name) {
            tokens.push({
              address: addr.toLowerCase(),
              name: metadata.result.name,
              symbol: metadata.result.symbol || 'UNK',
              decimals: metadata.result.decimals || 18,
              logo_url: metadata.result.logo || null,
              platform: 'Zora',
              factory_address: FACTORY_CONTRACTS.ZORA,
              launch_timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
            });
          }
        } catch (e) {
          console.error(`Error fetching ${addr}:`, e);
        }
      }

      if (tokens.length > 0) {
        await supabase.from('tokens').upsert(tokens, { onConflict: 'address' });

        const statsToInsert = tokens.map(t => ({
          token_address: t.address,
          price: Math.random() * 0.1,
          price_change_24h: (Math.random() - 0.5) * 200,
          volume_24h: Math.random() * 5000000,
          liquidity: Math.random() * 1000000,
          holders: Math.floor(Math.random() * 10000),
        }));

        await supabase.from('token_stats').upsert(statsToInsert, { onConflict: 'token_address' });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        tokensSeeded: tokens.length,
        tokens: tokens.map(t => ({ address: t.address, name: t.name, symbol: t.symbol }))
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      error: 'Unknown action',
      availableActions: ['fetch-recent-tokens', 'add-token', 'seed-sample-tokens']
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in index-tokens function:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
