-- Create enum for platform types
CREATE TYPE public.token_platform AS ENUM ('Zora', 'Clanker', 'Flaunch', 'Mint Club', 'Custom');

-- Create tokens table
CREATE TABLE public.tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  address TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  decimals INTEGER NOT NULL DEFAULT 18,
  total_supply NUMERIC,
  creator_address TEXT,
  platform token_platform NOT NULL DEFAULT 'Custom',
  factory_address TEXT,
  logo_url TEXT,
  metadata_uri TEXT,
  launch_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create token_stats table for current metrics
CREATE TABLE public.token_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token_address TEXT NOT NULL REFERENCES public.tokens(address) ON DELETE CASCADE,
  price NUMERIC DEFAULT 0,
  price_change_24h NUMERIC DEFAULT 0,
  volume_24h NUMERIC DEFAULT 0,
  market_cap NUMERIC DEFAULT 0,
  liquidity NUMERIC DEFAULT 0,
  holders INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(token_address)
);

-- Create token_history table for time-series data
CREATE TABLE public.token_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token_address TEXT NOT NULL REFERENCES public.tokens(address) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  price NUMERIC DEFAULT 0,
  volume NUMERIC DEFAULT 0,
  liquidity NUMERIC DEFAULT 0,
  holders INTEGER DEFAULT 0
);

-- Create creator_profiles table
CREATE TABLE public.creator_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  address TEXT NOT NULL UNIQUE,
  farcaster_handle TEXT,
  farcaster_fid INTEGER,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  followers INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_tokens_creator ON public.tokens(creator_address);
CREATE INDEX idx_tokens_platform ON public.tokens(platform);
CREATE INDEX idx_tokens_launch ON public.tokens(launch_timestamp DESC);
CREATE INDEX idx_token_stats_volume ON public.token_stats(volume_24h DESC);
CREATE INDEX idx_token_stats_price_change ON public.token_stats(price_change_24h DESC);
CREATE INDEX idx_token_history_token_time ON public.token_history(token_address, timestamp DESC);

-- Enable RLS
ALTER TABLE public.tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_profiles ENABLE ROW LEVEL SECURITY;

-- Public read policies (anyone can view token data)
CREATE POLICY "Tokens are publicly readable" ON public.tokens FOR SELECT USING (true);
CREATE POLICY "Token stats are publicly readable" ON public.token_stats FOR SELECT USING (true);
CREATE POLICY "Token history is publicly readable" ON public.token_history FOR SELECT USING (true);
CREATE POLICY "Creator profiles are publicly readable" ON public.creator_profiles FOR SELECT USING (true);

-- Enable realtime for tokens and stats
ALTER PUBLICATION supabase_realtime ADD TABLE public.tokens;
ALTER PUBLICATION supabase_realtime ADD TABLE public.token_stats;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add triggers for updated_at
CREATE TRIGGER update_tokens_updated_at
  BEFORE UPDATE ON public.tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_token_stats_updated_at
  BEFORE UPDATE ON public.token_stats
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_creator_profiles_updated_at
  BEFORE UPDATE ON public.creator_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();