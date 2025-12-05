# Notifica al Barbiere per Nuovo Cliente

## Descrizione
Quando un nuovo utente viene creato nella tabella `auth.users` di Supabase, viene automaticamente inviata una notifica a tutti i barbieri attivi che hanno un `user_id` collegato.

## Funzionalità
- **Trigger automatico**: Il trigger `on_auth_user_created` si attiva quando viene inserito un nuovo record in `auth.users`
- **Notifica ai barbieri**: Viene creata una notifica nella tabella `notifications` per ogni barbiere attivo
- **Filtri applicati**:
  - Solo barbieri con `active = true`
  - Solo barbieri con `user_id IS NOT NULL` (devono essere collegati a un account auth)
  - Solo barbieri con ruolo che contiene "barber" o è uno dei ruoli standard

## File Modificati
1. **sql/triggers.sql**: Modificata la funzione `handle_new_user()` per includere la logica di notifica
2. **sql/fix_notifications_trigger_insert.sql**: Nuovo file per assicurare che le policy RLS permettano l'inserimento da trigger

## Installazione

### Passo 1: Assicurati che il tipo 'new_client' sia supportato
Esegui il file `sql/fix_notifications_add_new_client_type.sql` se non l'hai già fatto:
```sql
-- Esegui su Supabase SQL Editor
\i sql/fix_notifications_add_new_client_type.sql
```

### Passo 2: Configura le policy RLS per permettere inserimento da trigger
Esegui il file `sql/fix_notifications_trigger_insert.sql`:
```sql
-- Esegui su Supabase SQL Editor
\i sql/fix_notifications_trigger_insert.sql
```

### Passo 3: Aggiorna il trigger
Esegui il file `sql/triggers.sql` per aggiornare la funzione trigger:
```sql
-- Esegui su Supabase SQL Editor
\i sql/triggers.sql
```

## Struttura della Notifica
Quando viene creato un nuovo utente, viene creata una notifica con:
- **type**: `'new_client'`
- **user_type**: `'staff'`
- **title**: `'👤 Nuovo Cliente Registrato'`
- **message**: `'{nome_cliente} si è appena registrato ({email})'`
- **data**: JSON con:
  - `client_user_id`: ID dell'utente appena creato
  - `client_name`: Nome completo del cliente
  - `client_email`: Email del cliente
  - `registered_at`: Timestamp della registrazione

## Requisiti
- I barbieri devono avere un record nella tabella `staff`
- I barbieri devono avere `active = true`
- I barbieri devono avere un `user_id` collegato a `auth.users`
- I barbieri devono avere un ruolo che contiene "barber" o è uno dei ruoli standard

## Test
Per testare la funzionalità:
1. Crea un nuovo utente tramite registrazione o direttamente in `auth.users`
2. Verifica che vengano create le notifiche nella tabella `notifications` per tutti i barbieri attivi
3. I barbieri dovrebbero vedere la notifica nella loro interfaccia

## Note
- Le notifiche vengono create solo per barbieri con `user_id` collegato
- Se un barbiere non ha un `user_id`, non riceverà notifiche
- Il trigger gestisce gli errori gracefully: se c'è un errore nella creazione della notifica, viene loggato ma l'inserimento del profilo continua






