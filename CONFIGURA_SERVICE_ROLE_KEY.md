# Come Configurare la Service Role Key

## 📍 Dove Configurarla

La `service_role_key` va configurata nella tabella `app_settings` del database Supabase.

## 🔑 Come Ottenere la Service Role Key

1. Vai su **Supabase Dashboard**: https://supabase.com/dashboard/project/tlwxsluoqzdluzneugbe
2. Vai su **Settings** (Impostazioni) nel menu laterale
3. Clicca su **API**
4. Nella sezione **Project API keys**, trova la chiave **"service_role"** (NON la "anon" key!)
5. Clicca sull'icona di copia per copiare la chiave

⚠️ **IMPORTANTE**: Usa la chiave **"service_role"**, NON la "anon" key!

## ⚙️ Come Configurarla

### Opzione 1: Usando lo Script SQL (Raccomandato)

1. Apri il file `sql/configure_service_role_key.sql`
2. Sostituisci `'TUA_SERVICE_ROLE_KEY_QUI'` con la tua chiave reale
3. Vai su **Supabase Dashboard > SQL Editor**
4. Incolla lo script modificato
5. Esegui lo script

### Opzione 2: Direttamente nel SQL Editor

Esegui questo comando SQL nel **Supabase Dashboard > SQL Editor**:

```sql
-- Sostituisci 'TUA_SERVICE_ROLE_KEY_QUI' con la tua chiave reale
UPDATE public.app_settings 
SET value = 'TUA_SERVICE_ROLE_KEY_QUI',
    updated_at = NOW()
WHERE key = 'service_role_key';
```

### Opzione 3: Verifica se è già configurata

Esegui questo per verificare:

```sql
SELECT 
    key,
    CASE 
        WHEN LENGTH(value) > 0 THEN '✅ Configurata (' || LENGTH(value) || ' caratteri)'
        ELSE '❌ NON configurata'
    END as status,
    updated_at
FROM public.app_settings
WHERE key = 'service_role_key';
```

## ✅ Verifica

Dopo aver configurato la chiave, verifica che funzioni:

1. Annulla un appuntamento (cambia status a 'cancelled')
2. Vai su **Supabase Dashboard > Logs > Postgres Logs**
3. Dovresti vedere messaggi come:
   - `✅ Email annullamento inviata al negozio: ...`
   - `✅ Email annullamento inviata al cliente: ...`

Se vedi invece:
- `⚠️ Service Role Key non configurata...`

Significa che la chiave non è stata configurata correttamente.

## 🔒 Sicurezza

⚠️ **NON condividere mai la service_role_key pubblicamente!**
- Non committarla nel repository Git
- Non condividerla in chat o email
- È una chiave con privilegi amministrativi completi

## 📝 Note

- La tabella `app_settings` viene creata automaticamente quando esegui la migration `20251129095150_fix_cancellation_emails_trigger.sql`
- Se la tabella non esiste, esegui prima la migration completa
- La chiave viene letta automaticamente dal trigger quando un appuntamento viene cancellato

