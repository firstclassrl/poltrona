# Database Setup Guide

Questo documento spiega come configurare il database per l'applicazione Poltrona.

## Tabelle del Database

L'applicazione richiede le seguenti tabelle:

1. **profiles** - Profili utente (già creata in setup_database.sql)
2. **shops** - Negozi (già creata in setup_database.sql)
3. **products** - Prodotti in vendita
4. **services** - Servizi offerti
5. **clients** - Clienti
6. **staff** - Personale
7. **appointments** - Appuntamenti
8. **chats** - Chat tra clienti e staff
9. **chat_messages** - Messaggi nelle chat

## Script SQL da Eseguire

### 1. Setup Base (già eseguito)
```sql
-- Esegui questo per primo
\i setup_database.sql
```

### 2. Tabelle Prodotti e Servizi
```sql
-- Crea le tabelle products e services
\i create_products_table.sql
\i create_services_table.sql
```

### 3. Tutte le Altre Tabelle
```sql
-- Crea tutte le tabelle rimanenti
\i create_all_tables.sql
```

## Ordine di Esecuzione

Esegui gli script nell'ordine seguente:

1. `setup_database.sql` (se non già eseguito)
2. `create_products_table.sql`
3. `create_services_table.sql`
4. `create_all_tables.sql`

## Verifica

Dopo aver eseguito tutti gli script, verifica che le tabelle siano state create correttamente:

```sql
-- Controlla che tutte le tabelle esistano
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Controlla i prodotti
SELECT COUNT(*) FROM public.products;

-- Controlla i servizi
SELECT COUNT(*) FROM public.services;
```

## Problemi Comuni

### Errore 401 Unauthorized
Se ricevi errori 401, verifica che:
1. L'utente sia loggato correttamente
2. Il token di autenticazione sia valido
3. Le policy RLS siano configurate correttamente

### Tabelle Non Trovate
Se ricevi errori "table does not exist", esegui gli script SQL nell'ordine corretto.

### Policy RLS
Tutte le tabelle hanno Row Level Security abilitato. Le policy permettono:
- Lettura per tutti gli utenti autenticati
- Scrittura solo per admin e manager (per products e services)
- Operazioni complete per utenti autenticati (per le altre tabelle)

## Dati di Esempio

Gli script includono dati di esempio per:
- 3 prodotti di base
- 5 servizi di base
- 3 membri dello staff

Questi dati vengono inseriti automaticamente quando esegui gli script.


