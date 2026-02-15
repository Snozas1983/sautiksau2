CREATE POLICY "No direct select access to bookings"
  ON public.bookings
  FOR SELECT
  USING (false);