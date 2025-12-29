-- Fix tokens that have 'priced' stage but no actual price
UPDATE public.tokens t
SET token_stage = 'discovered'
FROM public.token_stats ts
WHERE t.address = ts.token_address
  AND t.token_stage = 'priced'
  AND (ts.price IS NULL OR ts.price = 0);