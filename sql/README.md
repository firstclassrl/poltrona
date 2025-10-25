# Database Setup per Supabase

Questo file contiene gli script SQL per configurare il database del sistema Poltrona.

## File inclusi

- `setup_database.sql` - Script principale per configurare tutto il database
- `triggers.sql` - Trigger originali (backup)
- `README.md` - Questa documentazione

## Funzionalità

### 1. Creazione automatica profilo utente
Quando viene creato un nuovo utente in `auth.users`, viene automaticamente creato un record corrispondente nella tabella `public.profiles`.

**Trigger**: `on_auth_user_created`
- Si attiva: DOPO l'inserimento in `auth.users`
- Azione: Crea un nuovo record in `public.profiles`

### 2. Aggiornamento automatico profilo
Quando vengono aggiornati i metadati di un utente, il profilo viene aggiornato automaticamente.

**Trigger**: `on_auth_user_updated`
- Si attiva: DOPO l'aggiornamento in `auth.users`
- Azione: Aggiorna il record corrispondente in `public.profiles`

### 3. Eliminazione automatica profilo
Quando viene eliminato un utente, il profilo viene eliminato automaticamente.

**Trigger**: `on_auth_user_deleted`
- Si attiva: DOPO l'eliminazione in `auth.users`
- Azione: Elimina il record corrispondente in `public.profiles`

## Come utilizzare

### 1. Eseguire lo script di setup in Supabase

1. Vai al **SQL Editor** in Supabase
2. Copia e incolla il contenuto di `setup_database.sql`
3. Esegui lo script

### 2. Verificare il funzionamento

1. Crea un nuovo utente tramite l'interfaccia di autenticazione
2. Verifica che sia stato creato automaticamente un profilo
3. Controlla che i dati siano sincronizzati

### 3. Testare con un nuovo utente

1. Crea un nuovo utente tramite l'interfaccia di autenticazione
2. Verifica che sia stato creato automaticamente un profilo
3. Controlla che i dati siano sincronizzati

## Struttura del profilo creato

Quando viene creato un nuovo utente, il profilo avrà:

```sql
{
  user_id: "uuid_dell_utente",
  shop_id: NULL,  -- Da assegnare successivamente
  role: "user",   -- Ruolo di default
  full_name: "Nome dall'email o metadati",
  created_at: "timestamp_attuale"
}
```

## Sicurezza

- I trigger utilizzano `SECURITY DEFINER` per garantire i permessi necessari
- Le funzioni sono protette e possono essere eseguite solo dal sistema
- I trigger sono configurati per operare solo sui record autorizzati

## Troubleshooting

### Se il trigger non funziona:

1. Verifica che la tabella `profiles` esista
2. Controlla i permessi RLS (Row Level Security)
3. Verifica che i trigger siano attivi con la query di test
4. Controlla i log di Supabase per eventuali errori

### Se ci sono utenti senza profilo:

```sql
-- Trova utenti senza profilo
SELECT u.id, u.email, u.created_at
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.user_id
WHERE p.user_id IS NULL;

-- Crea profili mancanti manualmente
INSERT INTO public.profiles (user_id, role, full_name, created_at)
SELECT id, 'user', email, created_at
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.profiles);
```

## Note importanti

- I trigger sono irreversibili una volta creati
- Testa sempre in un ambiente di sviluppo prima della produzione
- Mantieni backup della struttura del database
- Monitora le performance dei trigger su grandi volumi di dati
