-- ============================================
-- CONFIGURA SERVICE_ROLE_KEY
-- ============================================
-- Questo script configura la service_role_key necessaria per inviare email
-- 
-- ISTRUZIONI:
-- 1. Vai su Supabase Dashboard > Settings > API
-- 2. Copia la "service_role" key (NON la anon key!)
-- 3. Sostituisci 'TUA_SERVICE_ROLE_KEY_QUI' qui sotto con la chiave copiata
-- 4. Esegui questo script nel Supabase SQL Editor
-- ============================================

-- Assicurati che la tabella app_settings esista
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Configura la service_role_key
-- ⚠️ SOSTITUISCI 'TUA_SERVICE_ROLE_KEY_QUI' CON LA TUA CHIAVE REALE!
UPDATE public.app_settings 
SET value = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsd3hzbHVvcXpkbHV6bmV1Z2JlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjAyNDc1OSwiZXhwIjoyMDcxNjAwNzU5fQ.soG2VBmwNy8L9TBle8W4YjdX0s3A1gwCJPuABQKIUuo',  -- <-- SOSTITUISCI QUI!
    updated_at = NOW()
WHERE key = 'service_role_key';

-- Se non esiste, creala
INSERT INTO public.app_settings (key, value, description, updated_at)
SELECT 
    'service_role_key',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsd3hzbHVvcXpkbHV6bmV1Z2JlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjAyNDc1OSwiZXhwIjoyMDcxNjAwNzU5fQ.soG2VBmwNy8L9TBle8W4YjdX0s3A1gwCJPuABQKIUuo',  -- <-- SOSTITUISCI QUI!
    'Service Role Key per chiamare le Edge Functions',
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM public.app_settings WHERE key = 'service_role_key'
);

-- Verifica la configurazione (non mostrerà la chiave completa per sicurezza)
SELECT 
    key,
    CASE 
        WHEN key = 'service_role_key' THEN 
            CASE 
                WHEN LENGTH(value) > 0 THEN '✅ Configurata (' || LENGTH(value) || ' caratteri)'
                ELSE '❌ NON configurata'
            END
        ELSE value
    END as status,
    description,
    updated_at
FROM public.app_settings
WHERE key = 'service_role_key';
















