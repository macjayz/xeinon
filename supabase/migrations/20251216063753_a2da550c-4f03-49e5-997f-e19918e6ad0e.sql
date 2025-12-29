-- Add transparent liquidity tracking columns
ALTER TABLE public.token_stats
  ADD COLUMN IF NOT EXISTS liquidity_dex numeric,
  ADD COLUMN IF NOT EXISTS liquidity_estimated numeric,
  ADD COLUMN IF NOT EXISTS liquidity_source text;

-- Backfill existing liquidity values as estimated (bonding curve)
UPDATE public.token_stats
SET liquidity_estimated = liquidity,
    liquidity_source = 'estimated'
WHERE liquidity IS NOT NULL AND liquidity > 0;

-- Use REPLICA IDENTITY FULL for better realtime payloads
ALTER TABLE public.token_stats REPLICA IDENTITY FULL;