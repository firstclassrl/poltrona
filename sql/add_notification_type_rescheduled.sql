-- Aggiunge il tipo 'appointment_rescheduled' al check constraint delle notifiche
-- Esegui in Supabase SQL editor sul progetto corrente

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

-- Mantiene RLS e policy già previste
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;






