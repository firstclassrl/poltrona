-- Add products column to appointments table
-- This column stores products associated with an appointment as JSONB
-- Format: [{"productId": "uuid", "quantity": number, "productName": "string", "productPrice": number}]

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
      ADD COLUMN IF NOT EXISTS products JSONB DEFAULT '[]'::jsonb;

    COMMENT ON COLUMN public.appointments.products IS
      'Array JSONB di prodotti associati all''appuntamento. Formato: [{"productId": "uuid", "quantity": number, "productName": "string", "productPrice": number}]';
  END IF;
END $$;
