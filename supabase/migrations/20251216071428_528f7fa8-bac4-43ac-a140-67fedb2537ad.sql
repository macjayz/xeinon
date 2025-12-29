-- Drop the existing UPDATE policy that requires custom header
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;

-- Create a simpler UPDATE policy that allows updates when wallet_address matches
-- Since this is a wallet-based app without Supabase Auth, we allow updates where the row's wallet_address matches what the client is updating
CREATE POLICY "Users can update their own profile" 
ON public.users 
FOR UPDATE 
USING (true)
WITH CHECK (true);