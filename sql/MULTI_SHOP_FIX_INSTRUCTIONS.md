# Istruzioni per Fix Multi-Shop Isolation

Questo documento contiene le istruzioni per applicare tutte le correzioni necessarie per garantire l'isolamento completo tra negozi.

## ⚠️ IMPORTANTE: Ordine di Esecuzione

Esegui gli script SQL nell'ordine seguente. **NON saltare nessuno step!**

## Step 1: Fix Trigger handle_new_user() (CRITICO)

**File**: `sql/triggers.sql`

Questo script è già stato modificato. Esegui solo la funzione `handle_new_user()` aggiornata:

```sql
-- Copia e incolla la funzione aggiornata da sql/triggers.sql
-- (righe 5-111)
```

**Cosa fa**: Filtra i barbieri per `shop_id` del nuovo utente, evitando notifiche cross-shop.

## Step 2: Rimuovi Policy Troppo Permissive (CRITICO - PRIMA DI TUTTO)

**File**: `sql/fix_rls_remove_permissive_policies.sql`

**Esegui PRIMA di tutto** per rimuovere le policy che permettono accesso senza controllo `shop_id`.

**Cosa fa**: Rimuove policy permissive da:
- appointments (2 policy)
- chats (1 policy)
- shop_daily_hours (5 policy)
- shop_daily_time_slots (6 policy)
- services (2 policy)

## Step 3: Fix RLS Policies per notifications (CRITICO)

**File**: `sql/fix_notifications_rls_shop_isolation.sql`

**Cosa fa**: Aggiorna le RLS policies per notifications per includere controllo `shop_id = current_shop_id()`.

## Step 4: Crea Trigger per chats

**File**: `sql/fix_chats_triggers_shop_id.sql`

**Cosa fa**: 
- Crea trigger per auto-assegnare `shop_id` a chats
- Aggiorna record esistenti senza `shop_id`

## Step 5: Crea Trigger per chat_messages

**File**: `sql/fix_chat_messages_triggers_shop_id.sql`

**Cosa fa**: 
- Crea trigger per auto-assegnare `shop_id` a chat_messages
- Aggiorna record esistenti senza `shop_id`

## Step 6: Verifica RLS per chats e chat_messages

**File**: 
- `sql/fix_chats_rls_shop_isolation.sql`
- `sql/fix_chat_messages_rls_shop_isolation.sql`

**Cosa fa**: Verifica che le RLS policies corrette siano presenti.

## Step 7: Verifica RLS per shop_daily_hours e shop_daily_time_slots

**File**: 
- `sql/fix_shop_daily_hours_rls_shop_isolation.sql`
- `sql/fix_shop_daily_time_slots_rls_shop_isolation.sql`

**Cosa fa**: Verifica che le policy pubbliche siano state rimosse e che quelle corrette siano attive.

## Step 8: Aggiungi Validazione Cross-Reference

**File**: `sql/validate_shop_consistency.sql`

**Cosa fa**: 
- Crea funzione e trigger per validare che `client_id`, `staff_id`, `service_id` appartengano allo stesso shop in appointments
- Previene creazione di appointments con riferimenti cross-shop

## Step 9: Verifica app_settings

**File**: `sql/fix_app_settings_shop_isolation.sql`

**Cosa fa**: Verifica se `app_settings` deve essere per-shop o globale.

**Azione richiesta**: Decidere se aggiungere `shop_id` o mantenere globale.

## Step 10: Validazione Completa

**File**: `sql/validate_shop_isolation.sql`

**Cosa fa**: Esegue una validazione completa per verificare:
- Record senza `shop_id`
- Inconsistenze cross-reference
- RLS policies corrette
- Trigger presenti
- Distribuzione dati per shop

## Checklist Post-Applicazione

Dopo aver eseguito tutti gli script, verifica:

- [ ] Nessun record senza `shop_id` (eseguire `validate_shop_isolation.sql`)
- [ ] Nessuna inconsistenza cross-reference
- [ ] Tutte le RLS policies filtrano per `shop_id`
- [ ] Tutti i trigger auto-assign sono attivi
- [ ] Test con entrambi i negozi (RETRO e test) - nessun crossing

## Test Consigliati

1. **Test Registrazione Nuovo Cliente**:
   - Registra un nuovo cliente nel negozio RETRO
   - Verifica che la notifica vada solo ai barbieri di RETRO
   - Registra un nuovo cliente nel negozio test
   - Verifica che la notifica vada solo ai barbieri di test

2. **Test Creazione Chat**:
   - Crea una chat nel negozio RETRO
   - Verifica che abbia `shop_id` corretto
   - Crea una chat nel negozio test
   - Verifica che abbia `shop_id` corretto

3. **Test Query API**:
   - Esegui `searchClients` nel negozio RETRO - deve restituire solo clienti RETRO
   - Esegui `getServices` nel negozio test - deve restituire solo servizi test
   - Esegui `getStaff` nel negozio RETRO - deve restituire solo staff RETRO

4. **Test Appointments**:
   - Prova a creare un appointment con `client_id` di RETRO e `staff_id` di test
   - Deve fallire con errore di validazione

## Rollback (se necessario)

Se qualcosa va storto, puoi ripristinare le policy permissive (anche se non consigliato):

```sql
-- NON eseguire a meno che non sia assolutamente necessario!
-- Queste policy permettono crossing tra negozi!

CREATE POLICY "Enable insert for authenticated users" ON public.appointments
  FOR INSERT WITH CHECK (true);
```

**NOTA**: Il rollback NON è consigliato. Meglio correggere i problemi specifici.

## Supporto

Se riscontri problemi:
1. Esegui `validate_shop_isolation.sql` per vedere cosa non va
2. Controlla i log di Supabase per errori
3. Verifica che `current_shop_id()` funzioni correttamente


