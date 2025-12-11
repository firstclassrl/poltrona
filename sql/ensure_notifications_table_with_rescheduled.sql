-- Assicura che la tabella notifications esista e includa il tipo 'appointment_rescheduled'
-- Esegui in Supabase SQL editor sul progetto corrente

-- 1) Crea la tabella se manca
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'notifications'
  ) THEN
    CREATE TABLE public.notifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      shop_id uuid NULL,
      user_id uuid NOT NULL,
      user_type text NOT NULL CHECK (user_type IN ('staff','client')),
      type text NOT NULL,
      title text NOT NULL,
      message text NOT NULL,
      data jsonb DEFAULT '{}'::jsonb,
      read_at timestamptz NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END$$;

-- 2) Aggiorna il check constraint sui tipi (aggiunge appointment_rescheduled)
ALTER TABLE public.notifications 
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type IN (
  'new_appointment',
  'appointment_cancelled',
  'appointment_rescheduled',
  'appointment_reminder',
  'system',
  'waitlist_available',
  'new_client'
));

-- 3) Abilita RLS e mantieni policy di inserimento da funzioni (se serve per trigger)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Functions can insert notifications" ON public.notifications;
CREATE POLICY "Functions can insert notifications" ON public.notifications
  FOR INSERT
  WITH CHECK (true);





