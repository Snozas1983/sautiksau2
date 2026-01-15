-- 1. Sukurti settings lentelę
CREATE TABLE public.settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read settings" ON public.settings
  FOR SELECT USING (true);

-- Įkelti pradinius nustatymus iš Airtable
INSERT INTO public.settings (key, value) VALUES
  ('work_start', '09:00'),
  ('work_end', '18:00'),
  ('break_between', '0'),
  ('booking_days_ahead', '60'),
  ('deposit_amount', '10'),
  ('cancel_hours_before', '24');

-- 2. Sukurti clients lentelę (juodam sąrašui)
CREATE TABLE public.clients (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  phone text UNIQUE NOT NULL,
  name text,
  is_blacklisted boolean DEFAULT false NOT NULL,
  blacklist_reason text,
  no_show_count integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can check blacklist" ON public.clients
  FOR SELECT USING (true);

-- 3. Modifikuoti bookings lentelę
ALTER TABLE public.bookings 
  ADD COLUMN IF NOT EXISTS date date,
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS end_time time;

ALTER TABLE public.bookings ALTER COLUMN slot_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_date_status ON public.bookings(date, status);

-- 4. Atnaujinti services lentelę
ALTER TABLE public.services DROP COLUMN IF EXISTS airtable_id;

ALTER TABLE public.services 
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS preparation_time integer DEFAULT 0;