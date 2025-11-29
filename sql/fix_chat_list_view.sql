-- ============================================
-- FIX: View per lista chat con dati completi
-- Esegui questo script su Supabase SQL Editor
-- ============================================
-- Questo script crea una view che restituisce le chat con
-- nome cliente, foto cliente, nome staff, foto staff,
-- ultimo messaggio e conteggio messaggi non letti

-- 1. Crea la view per le chat con tutti i dati necessari
CREATE OR REPLACE VIEW public.chats_with_details AS
SELECT 
  c.id,
  c.client_id,
  c.staff_id,
  c.created_at,
  c.updated_at,
  -- Dati cliente
  COALESCE(
    cl.first_name || ' ' || COALESCE(cl.last_name, ''),
    cl.email,
    'Cliente'
  ) as client_name,
  cl.photo_url as client_photo,
  -- Dati staff
  COALESCE(s.full_name, 'Barbiere') as staff_name,
  s.profile_photo_url as staff_photo,
  -- Ultimo messaggio
  (
    SELECT jsonb_build_object(
      'id', cm.id,
      'content', cm.content,
      'sender_type', cm.sender_type,
      'sender_id', cm.sender_id,
      'created_at', cm.created_at,
      'read_at', cm.read_at
    )
    FROM public.chat_messages cm
    WHERE cm.chat_id = c.id
    ORDER BY cm.created_at DESC
    LIMIT 1
  ) as last_message,
  -- Conteggio messaggi non letti
  (
    SELECT COUNT(*)
    FROM public.chat_messages cm
    WHERE cm.chat_id = c.id
      AND cm.read_at IS NULL
      AND cm.sender_type = 'staff'  -- Solo messaggi dal barbiere sono "non letti" per il cliente
  ) as unread_count
FROM public.chats c
LEFT JOIN public.clients cl ON c.client_id = cl.id
LEFT JOIN public.staff s ON c.staff_id = s.id;

-- 2. Abilita RLS sulla view (eredita le policy dalle tabelle sottostanti)
ALTER VIEW public.chats_with_details SET (security_invoker = true);

-- 3. Commenti per documentazione
COMMENT ON VIEW public.chats_with_details IS 'View che restituisce le chat con tutti i dati necessari per la visualizzazione: nome cliente, foto, nome staff, ultimo messaggio e conteggio non letti';

-- 4. Verifica che la view sia stata creata
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'chats_with_details';


