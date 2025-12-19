-- Add client_name to appointments for walk-in / phone bookings (no client account)
-- This allows creating appointments that block slots normally, without linking to a client record.

DO $$
BEGIN
  -- Add column only if appointments table exists
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'appointments'
  ) THEN
    ALTER TABLE public.appointments
      ADD COLUMN IF NOT EXISTS client_name TEXT;

    COMMENT ON COLUMN public.appointments.client_name IS
      'Nome cliente libero (post-it) per appuntamenti senza account: usato quando client_id è NULL.';
  END IF;
END $$;


