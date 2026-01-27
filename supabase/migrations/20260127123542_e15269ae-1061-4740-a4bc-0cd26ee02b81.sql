-- Add google_calendar_source column to track bookings imported from Google Calendar
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS google_calendar_source boolean DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.bookings.google_calendar_source IS 'True if booking was imported from Google Calendar';