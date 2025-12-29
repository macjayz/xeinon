-- Create users table for connected wallets
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  ens_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can view all profiles (public directory)
CREATE POLICY "Users are publicly readable" 
ON public.users 
FOR SELECT 
USING (true);

-- Users can insert their own record (unauthenticated - wallet connection)
CREATE POLICY "Anyone can insert users" 
ON public.users 
FOR INSERT 
WITH CHECK (true);

-- Users can update their own record
CREATE POLICY "Users can update their own profile" 
ON public.users 
FOR UPDATE 
USING (wallet_address = lower(current_setting('request.headers', true)::json->>'x-wallet-address'));

-- Create index for wallet lookups
CREATE INDEX idx_users_wallet_address ON public.users(wallet_address);

-- Add updated_at trigger
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();