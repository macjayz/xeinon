-- Create transactions table for tracking user buys and sells
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('buy', 'sell')),
  token_address TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  token_name TEXT,
  amount TEXT NOT NULL,
  payment_token TEXT NOT NULL,
  payment_amount TEXT NOT NULL,
  tx_hash TEXT NOT NULL UNIQUE,
  chain TEXT NOT NULL DEFAULT 'base',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Transactions are publicly readable (for transparency)
CREATE POLICY "Transactions are publicly readable"
ON public.transactions
FOR SELECT
USING (true);

-- Anyone can insert transactions (from frontend after successful trade)
CREATE POLICY "Anyone can insert transactions"
ON public.transactions
FOR INSERT
WITH CHECK (true);

-- Create index for wallet address lookups
CREATE INDEX idx_transactions_wallet ON public.transactions(wallet_address);
CREATE INDEX idx_transactions_token ON public.transactions(token_address);
CREATE INDEX idx_transactions_created ON public.transactions(created_at DESC);