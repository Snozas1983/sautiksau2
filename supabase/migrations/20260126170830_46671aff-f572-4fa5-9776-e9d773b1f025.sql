-- Add system booking columns to bookings table
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS is_system_booking boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS system_action_day integer,
ADD COLUMN IF NOT EXISTS google_calendar_event_id text;

-- Create index for system bookings queries
CREATE INDEX IF NOT EXISTS idx_bookings_is_system ON public.bookings(is_system_booking);
CREATE INDEX IF NOT EXISTS idx_bookings_google_event ON public.bookings(google_calendar_event_id);

-- Create google_calendar_tokens table
CREATE TABLE IF NOT EXISTS public.google_calendar_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  calendar_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on google_calendar_tokens
ALTER TABLE public.google_calendar_tokens ENABLE ROW LEVEL SECURITY;

-- Only allow reading via edge functions (no direct client access)
-- The table will be accessed only by edge functions with service role key

-- Add trigger for updated_at
CREATE TRIGGER update_google_calendar_tokens_updated_at
  BEFORE UPDATE ON public.google_calendar_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert SISTEMA client if not exists
INSERT INTO public.clients (phone, name, is_blacklisted, no_show_count)
VALUES ('SYSTEM-INTERNAL', 'SISTEMA', false, 0)
ON CONFLICT (phone) DO NOTHING;