-- ============================================
-- QUERY SEMPLICE: Cerca cliente@abruzzo.ai
-- Versione rapida - mostra solo se trovata o no
-- ============================================

SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM public.clients WHERE LOWER(email) = LOWER('cliente@abruzzo.ai'))
      OR EXISTS (SELECT 1 FROM public.staff WHERE LOWER(email) = LOWER('cliente@abruzzo.ai'))
      OR EXISTS (SELECT 1 FROM public.shops WHERE LOWER(notification_email) = LOWER('cliente@abruzzo.ai'))
      OR EXISTS (SELECT 1 FROM auth.users WHERE LOWER(email) = LOWER('cliente@abruzzo.ai'))
    THEN '✅ SUCCESS: Email trovata!'
    ELSE '❌ NOT FOUND: Email non trovata in nessuna tabella'
  END AS risultato;

-- ============================================
-- QUERY DETTAGLIATA: Cerca cliente@abruzzo.ai
-- Mostra se la mail è stata trovata e dove
-- ============================================

WITH email_search AS (
  -- Cerca nella tabella clients
  SELECT 
    'clients' AS tabella,
    'public.clients.email' AS dove_trovata,
    id::TEXT AS record_id,
    email,
    first_name || ' ' || COALESCE(last_name, '') AS nome,
    created_at
  FROM public.clients
  WHERE LOWER(email) = LOWER('cliente@abruzzo.ai')
  
  UNION ALL
  
  -- Cerca nella tabella staff
  SELECT 
    'staff' AS tabella,
    'public.staff.email' AS dove_trovata,
    id::TEXT AS record_id,
    email,
    full_name AS nome,
    created_at
  FROM public.staff
  WHERE LOWER(email) = LOWER('cliente@abruzzo.ai')
  
  UNION ALL
  
  -- Cerca nella tabella shops (notification_email)
  SELECT 
    'shops' AS tabella,
    'public.shops.notification_email' AS dove_trovata,
    id::TEXT AS record_id,
    notification_email AS email,
    name AS nome,
    created_at
  FROM public.shops
  WHERE LOWER(notification_email) = LOWER('cliente@abruzzo.ai')
  
  UNION ALL
  
  -- Cerca nella tabella auth.users (utenti autenticati)
  SELECT 
    'auth.users' AS tabella,
    'auth.users.email' AS dove_trovata,
    id::TEXT AS record_id,
    email,
    COALESCE(raw_user_meta_data->>'full_name', email) AS nome,
    created_at
  FROM auth.users
  WHERE LOWER(email) = LOWER('cliente@abruzzo.ai')
),
summary AS (
  -- Calcola il riepilogo
  SELECT 
    COUNT(*) AS count_total,
    STRING_AGG(DISTINCT dove_trovata, ', ') AS dove_trovata_agg,
    STRING_AGG(DISTINCT tabella, ', ') AS tabelle_agg
  FROM email_search
),
results_combined AS (
  -- Mostra il riepilogo
  SELECT 
    CASE 
      WHEN s.count_total > 0 
      THEN '✅ SUCCESS: Email trovata!'
      ELSE '❌ NOT FOUND: Email non trovata in nessuna tabella'
    END AS risultato,
    s.count_total::TEXT AS numero_occorrenze,
    COALESCE(s.dove_trovata_agg, 'Nessuna tabella') AS dove_trovata,
    COALESCE(s.tabelle_agg, 'Nessuna') AS tabelle,
    '' AS record_id,
    '' AS email,
    '' AS nome,
    '' AS created_at,
    1 AS ordine_risultato
  FROM summary s

  UNION ALL

  -- Mostra i dettagli se trovata
  SELECT 
    '📋 Dettaglio' AS risultato,
    '' AS numero_occorrenze,
    dove_trovata,
    tabella,
    record_id,
    email,
    nome,
    created_at::TEXT,
    2 AS ordine_risultato
  FROM email_search
)
SELECT 
  risultato,
  numero_occorrenze,
  dove_trovata,
  tabelle,
  record_id,
  email,
  nome,
  created_at
FROM results_combined
ORDER BY 
  ordine_risultato,
  created_at DESC NULLS LAST;

-- ============================================
-- VERSIONE 2: Query Dinamica (avanzata)
-- Trova automaticamente tutte le colonne che contengono email
-- ============================================

-- Questa query genera dinamicamente le query per cercare in tutte le tabelle
-- che hanno colonne con nomi che potrebbero contenere email
DO $$
DECLARE
  search_email TEXT := 'email@example.com'; -- Sostituisci con l'email da cercare
  query_text TEXT;
  result_record RECORD;
BEGIN
  -- Crea una tabella temporanea per i risultati
  CREATE TEMP TABLE IF NOT EXISTS email_search_results (
    tabella TEXT,
    colonna TEXT,
    record_id TEXT,
    email_value TEXT,
    created_at TIMESTAMP WITH TIME ZONE
  );
  
  TRUNCATE TABLE email_search_results;
  
  -- Trova tutte le colonne che potrebbero contenere email
  FOR result_record IN
    SELECT 
      t.table_schema,
      t.table_name,
      c.column_name
    FROM information_schema.tables t
    JOIN information_schema.columns c ON t.table_name = c.table_name 
      AND t.table_schema = c.table_schema
    WHERE t.table_schema IN ('public', 'auth')
      AND t.table_type = 'BASE TABLE'
      AND (
        c.column_name ILIKE '%email%' 
        OR c.column_name ILIKE '%mail%'
      )
      AND c.data_type IN ('text', 'character varying', 'varchar')
  LOOP
    -- Costruisci la query dinamica
    query_text := format(
      'INSERT INTO email_search_results (tabella, colonna, record_id, email_value, created_at)
       SELECT 
         %L AS tabella,
         %L AS colonna,
         COALESCE(id::TEXT, ''unknown'') AS record_id,
         %I::TEXT AS email_value,
         COALESCE(created_at, NOW()) AS created_at
       FROM %I.%I
       WHERE %I::TEXT ILIKE %L',
      result_record.table_schema || '.' || result_record.table_name,
      result_record.column_name,
      result_record.column_name,
      result_record.table_schema,
      result_record.table_name,
      result_record.column_name,
      '%' || search_email || '%'
    );
    
    -- Esegui la query (gestisce errori silenziosamente)
    BEGIN
      EXECUTE query_text;
    EXCEPTION WHEN OTHERS THEN
      -- Ignora errori (es. colonna id o created_at non esiste)
      NULL;
    END;
  END LOOP;
  
  -- Mostra i risultati
  RAISE NOTICE 'Risultati della ricerca per: %', search_email;
END $$;

-- Mostra i risultati dalla tabella temporanea
SELECT 
  tabella,
  colonna,
  record_id,
  email_value AS email,
  created_at
FROM email_search_results
ORDER BY created_at DESC;

-- ============================================
-- VERSIONE 3: Query Semplice per una singola email esatta
-- ============================================

-- Cerca una email specifica (match esatto, case-insensitive)
SELECT 
  'clients' AS tabella,
  id,
  email,
  first_name || ' ' || COALESCE(last_name, '') AS nome
FROM public.clients
WHERE LOWER(email) = LOWER('email@example.com')

UNION ALL

SELECT 
  'staff' AS tabella,
  id,
  email,
  full_name AS nome
FROM public.staff
WHERE LOWER(email) = LOWER('email@example.com')

UNION ALL

SELECT 
  'shops' AS tabella,
  id,
  notification_email AS email,
  name AS nome
FROM public.shops
WHERE LOWER(notification_email) = LOWER('email@example.com')

UNION ALL

SELECT 
  'auth.users' AS tabella,
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', email) AS nome
FROM auth.users
WHERE LOWER(email) = LOWER('email@example.com');
