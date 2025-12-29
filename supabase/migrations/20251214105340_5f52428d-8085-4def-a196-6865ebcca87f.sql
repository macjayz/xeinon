-- Create enum for token lifecycle stages
CREATE TYPE token_stage AS ENUM ('created', 'discovered', 'priced', 'liquid', 'traded', 'dead');

-- Create enum for data source
CREATE TYPE token_source AS ENUM ('zora_ws', 'zora_backfill', 'dex', 'bytecode_scan', 'manual');

-- Add new columns to tokens table
ALTER TABLE public.tokens 
ADD COLUMN IF NOT EXISTS token_stage token_stage NOT NULL DEFAULT 'created',
ADD COLUMN IF NOT EXISTS source token_source NOT NULL DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS creation_tx_hash text,
ADD COLUMN IF NOT EXISTS creation_block bigint,
ADD COLUMN IF NOT EXISTS creation_log_index integer;

-- Create index for efficient filtering by stage
CREATE INDEX IF NOT EXISTS idx_tokens_stage ON public.tokens(token_stage);
CREATE INDEX IF NOT EXISTS idx_tokens_source ON public.tokens(source);

-- Create a function to compute data_quality from token_stage
-- 'pending' = created, discovered
-- 'active' = priced, liquid, traded
-- This is a computed/virtual concept, not stored
COMMENT ON COLUMN public.tokens.token_stage IS 'Lifecycle stage: created->discovered->priced->liquid->traded->dead. pending=created/discovered, active=priced/liquid/traded';

-- Update existing tokens: set stage based on current stats
UPDATE public.tokens t
SET token_stage = CASE 
  WHEN EXISTS (
    SELECT 1 FROM public.token_stats ts 
    WHERE ts.token_address = t.address 
    AND (ts.volume_24h > 0)
  ) THEN 'traded'::token_stage
  WHEN EXISTS (
    SELECT 1 FROM public.token_stats ts 
    WHERE ts.token_address = t.address 
    AND (ts.liquidity > 0)
  ) THEN 'liquid'::token_stage
  WHEN EXISTS (
    SELECT 1 FROM public.token_stats ts 
    WHERE ts.token_address = t.address 
    AND (ts.price > 0 OR ts.holders > 0)
  ) THEN 'priced'::token_stage
  ELSE 'discovered'::token_stage
END,
source = 'zora_ws'::token_source
WHERE token_stage = 'created';