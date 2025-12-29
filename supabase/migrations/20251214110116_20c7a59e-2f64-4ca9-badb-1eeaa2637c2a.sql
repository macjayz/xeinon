-- Enable pg_cron and pg_net for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant permissions to use pg_net
GRANT USAGE ON SCHEMA net TO postgres;