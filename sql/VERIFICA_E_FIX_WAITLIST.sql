-- ============================================
-- SCRIPT DI VERIFICA E CORREZIONE WAITLIST
-- ============================================
-- Esegui questo script PRIMA di tutto per vedere cosa manca
-- e correggere eventuali problemi

-- ============================================
-- VERIFICA 1: Tabelle Esistenti
-- ============================================
SELECT 
    'VERIFICA TABELLE' as check_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'waitlist')
        THEN '✅ Tabella waitlist esiste'
        ELSE '❌ Tabella waitlist MANCANTE'
    END as waitlist_table,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clients')
        THEN '✅ Tabella clients esiste'
        ELSE '❌ Tabella clients MANCANTE'
    END as clients_table,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications')
        THEN '✅ Tabella notifications esiste'
        ELSE '❌ Tabella notifications MANCANTE'
    END as notifications_table;

-- ============================================
-- VERIFICA 2: Colonne Waitlist
-- ============================================
SELECT 
    'VERIFICA COLONNE WAITLIST' as check_type,
    column_name,
    data_type,
    CASE 
        WHEN column_name = 'notification_expires_at' THEN '✅ Colonna timeout presente'
        ELSE 'Colonna standard'
    END as status
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'waitlist'
ORDER BY ordinal_position;

-- ============================================
-- VERIFICA 3: Colonna user_id in clients
-- ============================================
SELECT 
    'VERIFICA USER_ID IN CLIENTS' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'clients' 
            AND column_name = 'user_id'
        )
        THEN '✅ Colonna user_id presente'
        ELSE '❌ Colonna user_id MANCANTE - Verrà aggiunta nello step 1'
    END as status;

-- ============================================
-- VERIFICA 4: Funzioni Esistenti
-- ============================================
SELECT 
    'VERIFICA FUNZIONI' as check_type,
    routine_name,
    CASE 
        WHEN routine_name = 'find_waitlist_clients_for_date' THEN '✅ Funzione base presente'
        WHEN routine_name = 'notify_next_waitlist_client' THEN '✅ Funzione timeout presente'
        WHEN routine_name = 'handle_waitlist_notification_timeout' THEN '✅ Funzione gestione timeout presente'
        WHEN routine_name = 'notify_waitlist_on_cancellation' THEN '✅ Funzione trigger presente'
        WHEN routine_name = 'update_waitlist_on_appointment_created' THEN '✅ Funzione booked presente'
        WHEN routine_name = 'notify_staff_new_waitlist_entry' THEN '✅ Funzione staff presente'
        ELSE 'Funzione trovata'
    END as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%waitlist%'
ORDER BY routine_name;

-- ============================================
-- VERIFICA 5: Trigger Esistenti
-- ============================================
SELECT 
    'VERIFICA TRIGGER' as check_type,
    trigger_name,
    event_object_table,
    event_manipulation,
    CASE 
        WHEN trigger_name = 'trigger_notify_waitlist_on_cancellation' THEN '✅ Trigger cancellazione presente'
        WHEN trigger_name = 'trigger_update_waitlist_on_appointment_created' THEN '✅ Trigger booked presente'
        WHEN trigger_name = 'trigger_notify_staff_new_waitlist' THEN '✅ Trigger staff presente'
        ELSE 'Trigger trovato'
    END as status
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
AND trigger_name LIKE '%waitlist%'
ORDER BY trigger_name;

-- ============================================
-- VERIFICA 6: Constraint Notifications
-- ============================================
SELECT 
    'VERIFICA CONSTRAINT NOTIFICATIONS' as check_type,
    constraint_name,
    check_clause,
    CASE 
        WHEN check_clause LIKE '%waitlist_available%' AND check_clause LIKE '%waitlist_summary%' 
        THEN '✅ Constraint completo'
        WHEN check_clause LIKE '%waitlist_available%' 
        THEN '⚠️ Constraint parziale (manca waitlist_summary)'
        ELSE '❌ Constraint non aggiornato'
    END as status
FROM information_schema.check_constraints 
WHERE constraint_schema = 'public' 
AND constraint_name = 'notifications_type_check';

-- ============================================
-- VERIFICA 7: RLS Policies Waitlist
-- ============================================
SELECT 
    'VERIFICA RLS POLICIES' as check_type,
    policyname,
    cmd,
    CASE 
        WHEN cmd = 'SELECT' THEN '✅ Policy SELECT presente'
        WHEN cmd = 'INSERT' THEN '✅ Policy INSERT presente'
        WHEN cmd = 'UPDATE' THEN '✅ Policy UPDATE presente'
        WHEN cmd = 'DELETE' THEN '✅ Policy DELETE presente'
        WHEN cmd = 'ALL' THEN '✅ Policy ALL presente'
        ELSE 'Policy trovata'
    END as status
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'waitlist'
ORDER BY policyname;

-- ============================================
-- CORREZIONE AUTOMATICA: Rimuovi Duplicati
-- ============================================
-- Rimuovi trigger duplicati se esistono
DO $$
BEGIN
    -- Rimuovi tutti i trigger waitlist vecchi
    DROP TRIGGER IF EXISTS trigger_notify_waitlist_on_cancellation ON public.appointments;
    DROP TRIGGER IF EXISTS trigger_update_waitlist_on_appointment_created ON public.appointments;
    DROP TRIGGER IF EXISTS trigger_notify_staff_new_waitlist ON public.waitlist;
    
    RAISE NOTICE 'Trigger vecchi rimossi (se esistevano)';
END $$;

-- ============================================
-- RIEPILOGO FINALE
-- ============================================
SELECT 
    'RIEPILOGO' as check_type,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'waitlist') as tabelle_waitlist,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'waitlist' AND column_name = 'notification_expires_at') as colonna_timeout,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'user_id') as colonna_user_id,
    (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name LIKE '%waitlist%') as funzioni_totali,
    (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = 'public' AND trigger_name LIKE '%waitlist%') as trigger_totali,
    (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'waitlist') as policies_totali;

