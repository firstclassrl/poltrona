-- ============================================
-- FIX: Aggiungi tipo 'new_client' alle notifiche
-- Esegui questo script su Supabase SQL Editor
-- ============================================

-- Rimuovi il constraint esistente
ALTER TABLE public.notifications 
DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Aggiungi il nuovo constraint con 'new_client' incluso
ALTER TABLE public.notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type IN ('new_appointment', 'appointment_cancelled', 'appointment_reminder', 'system', 'new_client'));

-- Verifica che il constraint sia stato applicato
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.notifications'::regclass
  AND conname = 'notifications_type_check';

-- Commento aggiornato
COMMENT ON COLUMN public.notifications.type IS 'Tipo: new_appointment, appointment_cancelled, appointment_reminder, system, new_client';




