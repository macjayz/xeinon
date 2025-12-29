
-- Create token_detections table (raw intake layer, append-only)
CREATE TABLE public.token_detections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chain TEXT NOT NULL DEFAULT 'base',
  address TEXT NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source token_source NOT NULL,
  tx_hash TEXT,
  block_number BIGINT,
  log_index INT,
  factory_address TEXT,
  code_hash TEXT,
  matched_fingerprint TEXT,
  processed BOOLEAN DEFAULT false,
  raw_data JSONB
);

-- Create index for processing queue
CREATE INDEX idx_token_detections_unprocessed ON public.token_detections(processed, detected_at) WHERE processed = false;
CREATE INDEX idx_token_detections_address ON public.token_detections(chain, address);
CREATE INDEX idx_token_detections_ttl ON public.token_detections(detected_at);

-- Enable RLS
ALTER TABLE public.token_detections ENABLE ROW LEVEL SECURITY;

-- Detections are internal only, no public read
CREATE POLICY "Token detections are not publicly readable" 
ON public.token_detections 
FOR SELECT 
USING (false);

-- Create token_provenance table (multi-source truth)
CREATE TABLE public.token_provenance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token_address TEXT NOT NULL,
  chain TEXT NOT NULL DEFAULT 'base',
  source token_source NOT NULL,
  tx_hash TEXT,
  block_number BIGINT,
  log_index INT,
  factory_address TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_primary BOOLEAN DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(token_address, chain, source, tx_hash)
);

-- Create indexes
CREATE INDEX idx_token_provenance_address ON public.token_provenance(token_address);
CREATE INDEX idx_token_provenance_primary ON public.token_provenance(token_address) WHERE is_primary = true;

-- Enable RLS
ALTER TABLE public.token_provenance ENABLE ROW LEVEL SECURITY;

-- Provenance is publicly readable for transparency
CREATE POLICY "Token provenance is publicly readable" 
ON public.token_provenance 
FOR SELECT 
USING (true);

-- Create token_stage_history table (lifecycle audit trail)
CREATE TABLE public.token_stage_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token_address TEXT NOT NULL,
  chain TEXT NOT NULL DEFAULT 'base',
  from_stage token_stage,
  to_stage token_stage NOT NULL,
  reason TEXT,
  triggered_by token_source,
  stats_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_token_stage_history_address ON public.token_stage_history(token_address);
CREATE INDEX idx_token_stage_history_timeline ON public.token_stage_history(token_address, created_at);

-- Enable RLS
ALTER TABLE public.token_stage_history ENABLE ROW LEVEL SECURITY;

-- Stage history is publicly readable for transparency
CREATE POLICY "Token stage history is publicly readable" 
ON public.token_stage_history 
FOR SELECT 
USING (true);

-- Create bytecode_fingerprints table (classifier DB)
CREATE TABLE public.bytecode_fingerprints (
  fingerprint_id TEXT PRIMARY KEY,
  description TEXT,
  standard TEXT NOT NULL DEFAULT 'ERC20',
  selectors TEXT[] NOT NULL,
  confidence INT NOT NULL DEFAULT 50 CHECK (confidence >= 0 AND confidence <= 100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bytecode_fingerprints ENABLE ROW LEVEL SECURITY;

-- Fingerprints are publicly readable
CREATE POLICY "Bytecode fingerprints are publicly readable" 
ON public.bytecode_fingerprints 
FOR SELECT 
USING (true);

-- Insert default ERC-20 fingerprints
INSERT INTO public.bytecode_fingerprints (fingerprint_id, description, standard, selectors, confidence) VALUES
  ('erc20_core', 'Core ERC-20 standard', 'ERC20', ARRAY['06fdde03', '95d89b41', '313ce567', '70a08231', '18160ddd', 'a9059cbb'], 80),
  ('erc20_full', 'Full ERC-20 with approve/allowance', 'ERC20', ARRAY['06fdde03', '95d89b41', '313ce567', '70a08231', '18160ddd', 'a9059cbb', '095ea7b3', 'dd62ed3e', '23b872dd'], 95),
  ('erc20_minimal', 'Minimal ERC-20 (name, symbol, transfer)', 'ERC20', ARRAY['06fdde03', '95d89b41', 'a9059cbb'], 60);

-- Add chain column to tokens if not exists (for multi-chain future)
ALTER TABLE public.tokens ADD COLUMN IF NOT EXISTS chain TEXT NOT NULL DEFAULT 'base';

-- Add first_seen_at column
ALTER TABLE public.tokens ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ DEFAULT now();

-- Migrate existing provenance data from tokens to token_provenance
INSERT INTO public.token_provenance (token_address, chain, source, tx_hash, block_number, log_index, factory_address, is_primary, detected_at)
SELECT 
  address,
  'base',
  source,
  creation_tx_hash,
  creation_block,
  creation_log_index,
  factory_address,
  true,
  COALESCE(launch_timestamp, created_at)
FROM public.tokens
WHERE source IS NOT NULL
ON CONFLICT DO NOTHING;

-- Migrate existing stage data to token_stage_history (initial state)
INSERT INTO public.token_stage_history (token_address, chain, from_stage, to_stage, reason, triggered_by, created_at)
SELECT 
  address,
  'base',
  NULL,
  token_stage,
  'Initial migration from legacy schema',
  source,
  created_at
FROM public.tokens
ON CONFLICT DO NOTHING;

-- Create function to track stage changes
CREATE OR REPLACE FUNCTION public.track_token_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.token_stage IS DISTINCT FROM NEW.token_stage THEN
    INSERT INTO public.token_stage_history (token_address, chain, from_stage, to_stage, reason, triggered_by, stats_snapshot)
    VALUES (
      NEW.address,
      COALESCE(NEW.chain, 'base'),
      OLD.token_stage,
      NEW.token_stage,
      'Stage updated',
      NEW.source,
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for stage tracking
DROP TRIGGER IF EXISTS track_token_stage ON public.tokens;
CREATE TRIGGER track_token_stage
AFTER UPDATE ON public.tokens
FOR EACH ROW
EXECUTE FUNCTION public.track_token_stage_change();

-- Create function to enforce monotonic stage progression
CREATE OR REPLACE FUNCTION public.enforce_stage_progression()
RETURNS TRIGGER AS $$
DECLARE
  stage_order INTEGER[];
  old_order INTEGER;
  new_order INTEGER;
BEGIN
  -- Define stage order: created=1, discovered=2, priced=3, liquid=4, traded=5, dead=99
  stage_order := ARRAY[1, 2, 3, 4, 5, 99];
  
  old_order := CASE OLD.token_stage
    WHEN 'created' THEN 1
    WHEN 'discovered' THEN 2
    WHEN 'priced' THEN 3
    WHEN 'liquid' THEN 4
    WHEN 'traded' THEN 5
    WHEN 'dead' THEN 99
    ELSE 0
  END;
  
  new_order := CASE NEW.token_stage
    WHEN 'created' THEN 1
    WHEN 'discovered' THEN 2
    WHEN 'priced' THEN 3
    WHEN 'liquid' THEN 4
    WHEN 'traded' THEN 5
    WHEN 'dead' THEN 99
    ELSE 0
  END;
  
  -- Allow progression forward or to dead state only
  IF new_order < old_order AND NEW.token_stage != 'dead' THEN
    RAISE EXCEPTION 'Stage downgrade not allowed: % -> %', OLD.token_stage, NEW.token_stage;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for stage progression enforcement
DROP TRIGGER IF EXISTS enforce_stage_progression ON public.tokens;
CREATE TRIGGER enforce_stage_progression
BEFORE UPDATE ON public.tokens
FOR EACH ROW
EXECUTE FUNCTION public.enforce_stage_progression();

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.token_provenance;
ALTER PUBLICATION supabase_realtime ADD TABLE public.token_stage_history;
