-- Add airtable_id column for sync tracking
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS airtable_id text UNIQUE;

-- Create index for faster lookups during sync
CREATE INDEX IF NOT EXISTS idx_services_airtable_id ON public.services(airtable_id);