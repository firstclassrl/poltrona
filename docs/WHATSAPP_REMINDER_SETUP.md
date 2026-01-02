# Guida Setup: Reminder WhatsApp con n8n

## Panoramica

Questa guida ti accompagna passo-passo nella configurazione del sistema di reminder WhatsApp automatici per gli appuntamenti. Il sistema invia ogni giorno alle 20:00 (orario configurabile) un messaggio WhatsApp a tutti i clienti che hanno un appuntamento il giorno successivo.

## Prerequisiti

- Account Meta Business (Facebook Business)
- Account n8n Cloud (o n8n self-hosted)
- Accesso al database Supabase
- Service Role Key di Supabase

## Passo 1: Configurare WhatsApp Cloud API

### 1.1 Creare App Meta

1. Vai su [Meta for Developers](https://developers.facebook.com/)
2. Clicca su **"My Apps"** → **"Create App"**
3. Seleziona **"Business"** come tipo di app
4. Compila i dettagli:
   - **App Name**: `Poltrona WhatsApp Reminders` (o nome a tua scelta)
   - **App Contact Email**: La tua email
   - **Business Account**: Seleziona il tuo account business

### 1.2 Aggiungere Prodotto WhatsApp

1. Nella dashboard dell'app, vai su **"Add Product"**
2. Cerca **"WhatsApp"** e clicca **"Set Up"**
3. Segui il wizard di configurazione

### 1.3 Ottenere Phone Number ID

1. Vai su **WhatsApp** → **API Setup** nella dashboard
2. Se non hai ancora un numero, clicca su **"Add phone number"**
3. Segui le istruzioni per verificare il tuo numero WhatsApp Business
4. Una volta verificato, copia il **Phone Number ID** (es. `123456789012345`)

**Nota**: Il Phone Number ID è diverso dal numero di telefono. È un identificatore univoco per l'API.

### 1.4 Ottenere Access Token

1. Nella stessa pagina **API Setup**, trova la sezione **"Temporary access token"**
2. Per produzione, crea un **Permanent Access Token**:
   - Vai su **WhatsApp** → **API Setup**
   - Clicca su **"Generate access token"**
   - Seleziona le permissions necessarie:
     - `whatsapp_business_messaging`
     - `whatsapp_business_management`
   - Copia il token generato

**⚠️ IMPORTANTE**: Salva il token in un posto sicuro. Non condividerlo pubblicamente.

### 1.5 Configurare Webhook (Opzionale)

Se vuoi ricevere notifiche di consegna/lettura messaggi:

1. Vai su **WhatsApp** → **Configuration**
2. In **"Webhook"**, clicca **"Edit"**
3. Inserisci:
   - **Callback URL**: URL del tuo webhook n8n (opzionale)
   - **Verify Token**: Token personalizzato per verificare il webhook
4. Seleziona gli eventi da ricevere:
   - `messages`
   - `message_status`

## Passo 2: Configurare n8n

### 2.1 Creare Account n8n Cloud

1. Vai su [n8n Cloud](https://www.n8n.io/cloud/)
2. Crea un account o accedi
3. Crea un nuovo workspace (se necessario)

### 2.2 Configurare Variabili Ambiente

1. In n8n, vai su **Settings** → **Environment Variables**
2. Aggiungi le seguenti variabili:

#### Variabili Obbligatorie:

| Nome | Valore | Descrizione |
|------|--------|-------------|
| `SUPABASE_PROJECT` | `tuo-project-id` | Il tuo Supabase Project ID (es. `abcdefghijklmnop`) |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGc...` | La tua Supabase Service Role Key |
| `WHATSAPP_PHONE_NUMBER_ID` | `123456789012345` | Phone Number ID ottenuto da Meta |
| `WHATSAPP_ACCESS_TOKEN` | `EAABwzLix...` | Access Token permanente di WhatsApp Cloud API |

#### Variabili Opzionali:

| Nome | Valore | Descrizione |
|------|--------|-------------|
| `WHATSAPP_API_VERSION` | `v18.0` | Versione API WhatsApp (default: v18.0) |

**Come trovare Supabase Project ID e Service Role Key**:
1. Vai su [Supabase Dashboard](https://app.supabase.com/)
2. Seleziona il tuo progetto
3. Vai su **Settings** → **API**
4. Copia:
   - **Project URL**: Il Project ID è nella URL (es. `https://abcdefghijklmnop.supabase.co`)
   - **service_role key**: La chiave sotto "Project API keys" → "service_role" (secret)

### 2.3 Importare Workflow

1. In n8n, clicca su **"Workflows"** → **"Import from File"** o **"Import from URL"**
2. Crea manualmente il workflow seguendo la documentazione in `docs/n8n-workflows/whatsapp-reminder-workflow.md`
3. Oppure copia il JSON del workflow (se disponibile) e importalo

**Nota**: Per ora, crea il workflow manualmente seguendo la guida dettagliata nel file di documentazione.

### 2.4 Configurare CRON

1. Nel workflow, trova il nodo **"Cron Trigger"**
2. Imposta:
   - **Cron Expression**: `0 20 * * *` (ogni giorno alle 20:00)
   - **Timezone**: `Europe/Rome` (o il tuo timezone)
3. Salva il workflow

### 2.5 Testare Workflow

1. Clicca su **"Execute Workflow"** per testare manualmente
2. Verifica che tutti i nodi vengano eseguiti correttamente
3. Controlla i log per eventuali errori

## Passo 3: Eseguire Migration SQL

### 3.1 Eseguire Script SQL

1. Vai su [Supabase Dashboard](https://app.supabase.com/)
2. Seleziona il tuo progetto
3. Vai su **SQL Editor**
4. Apri il file `sql/setup_whatsapp_reminders.sql`
5. Copia e incolla il contenuto nell'editor SQL
6. Clicca su **"Run"** per eseguire lo script

### 3.2 Verificare Migration

Esegui questa query per verificare che i campi siano stati aggiunti:

```sql
-- Verifica appointments
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'appointments'
  AND column_name IN ('reminder_sent', 'reminder_sent_at');

-- Verifica shops
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'shops'
  AND column_name IN ('whatsapp_reminder_enabled', 'whatsapp_reminder_time');
```

Dovresti vedere tutti i campi con i loro tipi e default.

## Passo 4: Configurare Negozio (Opzionale)

### 4.1 Abilitare/Disabilitare Reminder per Negozio

```sql
-- Abilita reminder per un negozio specifico
UPDATE public.shops
SET whatsapp_reminder_enabled = true
WHERE id = 'shop-uuid';

-- Disabilita reminder per un negozio specifico
UPDATE public.shops
SET whatsapp_reminder_enabled = false
WHERE id = 'shop-uuid';
```

### 4.2 Personalizzare Orario Reminder

```sql
-- Cambia orario reminder per un negozio (es. 18:00 invece di 20:00)
UPDATE public.shops
SET whatsapp_reminder_time = '18:00'
WHERE id = 'shop-uuid';
```

**Nota**: Per ora, il workflow n8n usa un orario globale. Per supportare orari diversi per negozio, devi modificare il workflow.

### 4.3 Configurare Credenziali WhatsApp per Negozio (Opzionale)

Se vuoi usare credenziali diverse per ogni negozio:

```sql
-- Configura Phone Number ID e Access Token per negozio
UPDATE public.shops
SET 
  whatsapp_phone_number_id = '123456789012345',
  whatsapp_access_token = 'EAABwzLix...'
WHERE id = 'shop-uuid';
```

**⚠️ SICUREZZA**: Si consiglia di usare variabili ambiente n8n invece di salvare token nel database.

## Passo 5: Testare il Sistema

### 5.1 Creare Appuntamento di Test

1. Crea un appuntamento per domani nel tuo sistema
2. Assicurati che:
   - Il cliente abbia un numero WhatsApp valido in formato E.164 (es. `+393491234567`)
   - Lo status sia `scheduled`, `confirmed` o `rescheduled`
   - `reminder_sent` sia `false`

### 5.2 Eseguire Workflow Manualmente

1. In n8n, apri il workflow
2. Clicca su **"Execute Workflow"**
3. Verifica che:
   - Il workflow trovi l'appuntamento
   - Il messaggio venga inviato correttamente
   - Il flag `reminder_sent` venga aggiornato a `true`

### 5.3 Verificare Invio Messaggio

1. Controlla il telefono del cliente di test
2. Verifica che il messaggio WhatsApp sia arrivato
3. Controlla il formato e il contenuto del messaggio

### 5.4 Verificare Aggiornamento Database

```sql
-- Verifica che reminder_sent sia stato aggiornato
SELECT 
  id,
  start_at,
  reminder_sent,
  reminder_sent_at,
  status
FROM public.appointments
WHERE reminder_sent = true
ORDER BY reminder_sent_at DESC
LIMIT 10;
```

### 5.5 Testare Prevenzione Duplicati

1. Esegui di nuovo il workflow manualmente
2. Verifica che lo stesso appuntamento NON riceva un secondo messaggio
3. Controlla che `reminder_sent` rimanga `true`

## Passo 6: Attivare in Produzione

### 6.1 Verificare Configurazione

- [ ] WhatsApp Cloud API configurato
- [ ] Phone Number ID e Access Token salvati in n8n
- [ ] Variabili ambiente n8n configurate
- [ ] Workflow n8n creato e testato
- [ ] Migration SQL eseguita
- [ ] Test manuale completato con successo

### 6.2 Attivare Workflow

1. In n8n, assicurati che il workflow sia **"Active"**
2. Verifica che il CRON sia configurato correttamente: `0 20 * * *`
3. Il workflow si eseguirà automaticamente ogni giorno alle 20:00

### 6.3 Monitorare Primi Giorni

1. Controlla i log n8n ogni giorno
2. Verifica che i messaggi vengano inviati correttamente
3. Monitora eventuali errori
4. Controlla che non ci siano duplicati

## Troubleshooting

### Messaggi non vengono inviati

**Possibili cause**:
1. **Token scaduto**: Rigenera Access Token in Meta Business
2. **Numero non valido**: Verifica formato E.164 (`+39...`)
3. **Rate limiting**: WhatsApp ha limiti (1000/giorno per numeri di test)
4. **Workflow non attivo**: Verifica che il workflow sia attivo in n8n

**Soluzione**:
- Controlla log n8n per errori specifici
- Verifica credenziali WhatsApp
- Testa invio manuale con curl o Postman

### Messaggi duplicati

**Possibili cause**:
1. Flag `reminder_sent` non aggiornato
2. Workflow eseguito più volte

**Soluzione**:
- Verifica che il nodo "Update Reminder Sent" venga eseguito
- Controlla che non ci siano workflow duplicati

### Appuntamenti saltati

**Possibili cause**:
1. Filtro troppo restrittivo
2. Query Supabase errata

**Soluzione**:
- Verifica condizioni nel nodo "Filter Appointments"
- Controlla parametri query Supabase

## Sicurezza

### Best Practices

1. **Token**: Non salvare token nel database, usa variabili ambiente n8n
2. **Service Role Key**: Non esporre la Service Role Key pubblicamente
3. **Webhook**: Se usi webhook, verifica sempre il token
4. **RLS**: Assicurati che le RLS policies siano configurate correttamente

### Rotazione Token

1. Rigenera Access Token WhatsApp periodicamente
2. Aggiorna variabile ambiente n8n con nuovo token
3. Testa che tutto funzioni ancora

## Supporto

Per problemi o domande:
1. Controlla la documentazione in `docs/n8n-workflows/whatsapp-reminder-workflow.md`
2. Verifica i log n8n per errori specifici
3. Consulta la documentazione ufficiale:
   - [WhatsApp Cloud API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api)
   - [n8n Documentation](https://docs.n8n.io/)

## Prossimi Passi

- [ ] Personalizzare template messaggi per negozio
- [ ] Implementare retry automatico per errori
- [ ] Aggiungere statistiche invii
- [ ] Supportare orari diversi per negozio
- [ ] Implementare notifiche admin per errori
