# 🚀 Setup Sistema Waitlist Migliorato

## 📋 Panoramica Miglioramenti Implementati

1. ✅ **Sistema Timeout Notifiche** - Timeout di 15 minuti, notifica automatica al prossimo cliente
2. ✅ **Notifiche Email via Webhook N8N** - Email automatiche quando cliente viene notificato
3. ✅ **Range Date Esteso** - Da 3 a 7 giorni
4. ✅ **Dashboard Waitlist Staff** - Dashboard completa con statistiche
5. ✅ **Notifiche In-App Staff** - Notifiche quando ci sono molti clienti in waitlist

---

## 🔧 Setup Database

### Step 1: Eseguire Script SQL

Esegui questi script nell'ordine indicato nel SQL Editor di Supabase:

1. **`sql/fix_waitlist_system.sql`** - Fix sistema base (se non già eseguito)
2. **`sql/improve_waitlist_timeout_and_email.sql`** - Timeout e webhook email
3. **`sql/add_waitlist_staff_notifications.sql`** - Notifiche staff

---

## 📧 Configurazione Webhook N8N per Email

### Step 1: Crea Workflow N8N

1. Vai su N8N e crea un nuovo workflow
2. Aggiungi un nodo **Webhook** come trigger
3. Configura:
   - **Method**: POST
   - **Path**: `/webhook/waitlist-notification`
   - **Response Mode**: Respond to Webhook
   - **Authentication**: Header Auth con token

### Step 2: Configura Webhook Supabase

**Opzione A: Usando Supabase Dashboard (Consigliato)**

1. Vai su Supabase Dashboard > Database > Webhooks
2. Clicca "Create a new webhook"
3. Configura:
   - **Name**: `waitlist_notification_email`
   - **Table**: `notifications`
   - **Events**: INSERT
   - **Filter**: `type = 'waitlist_available'`
   - **HTTP Request**:
     - **URL**: `https://tuo-n8n.app.n8n.cloud/webhook/waitlist-notification`
     - **HTTP Method**: POST
     - **HTTP Headers**:
       ```
       Content-Type: application/json
       Authorization: Bearer TUO_SECRET_TOKEN
       ```
     - **HTTP Request Body**:
       ```json
       {
         "event": "waitlist_notification",
         "client_email": "{{ $body.record.data.client_email }}",
         "client_name": "{{ $body.record.data.client_name }}",
         "available_date": "{{ $body.record.data.available_date }}",
         "available_time": "{{ $body.record.data.available_time }}",
         "service_name": "{{ $body.record.data.service_name }}",
         "staff_name": "{{ $body.record.data.staff_name }}",
         "waitlist_id": "{{ $body.record.data.waitlist_id }}",
         "booking_link": "https://app.poltrona.ai/booking?date={{ $body.record.data.available_date }}"
       }
       ```

**Opzione B: Usando pg_net (se disponibile)**

Se hai pg_net abilitato, lo script SQL userà direttamente `net.http_post`. Configura le variabili:

```sql
-- Configura URL webhook N8N
ALTER DATABASE postgres SET app.n8n_webhook_url = 'https://tuo-n8n.app.n8n.cloud/webhook/waitlist-notification';
ALTER DATABASE postgres SET app.n8n_webhook_secret = 'TUO_SECRET_TOKEN';
```

### Step 3: Template Email N8N

Nel workflow N8N, aggiungi un nodo **Email** (Resend o SMTP) con questo template:

**Subject:**
```
🎯 Posto Disponibile - {{ $json.available_date }}
```

**Body (HTML):**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
    .details { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; }
    .detail-row { margin: 10px 0; }
    .label { font-weight: bold; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎯 Posto Disponibile!</h1>
    </div>
    <div class="content">
      <p>Ciao {{ $json.client_name }},</p>
      <p>Si è liberato un posto per te!</p>
      
      <div class="details">
        <div class="detail-row">
          <span class="label">Data:</span> {{ $json.available_date }}
        </div>
        {{#if $json.available_time}}
        <div class="detail-row">
          <span class="label">Orario:</span> {{ $json.available_time }}
        </div>
        {{/if}}
        {{#if $json.service_name}}
        <div class="detail-row">
          <span class="label">Servizio:</span> {{ $json.service_name }}
        </div>
        {{/if}}
        {{#if $json.staff_name}}
        <div class="detail-row">
          <span class="label">Barbiere:</span> {{ $json.staff_name }}
        </div>
        {{/if}}
      </div>
      
      <p><strong>Hai 15 minuti per prenotare!</strong></p>
      
      <a href="{{ $json.booking_link }}" class="button">Prenota Ora</a>
      
      <p style="margin-top: 30px; font-size: 12px; color: #666;">
        Se non prenoti entro 15 minuti, il posto sarà offerto al prossimo cliente in lista d'attesa.
      </p>
    </div>
  </div>
</body>
</html>
```

---

## ⏱️ Configurazione Job Schedulato per Timeout

### Opzione 1: Supabase Edge Function + Cron Esterno (Consigliato)

1. **Crea Edge Function** in Supabase:
   - Nome: `handle-waitlist-timeout`
   - Codice:
   ```typescript
   import { createClient } from '@supabase/supabase-js'

   Deno.serve(async (req) => {
     const supabase = createClient(
       Deno.env.get('SUPABASE_URL') ?? '',
       Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
     )
     
     const { data, error } = await supabase.rpc('handle_waitlist_notification_timeout')
     
     return new Response(
       JSON.stringify({ processed: data || 0, error }),
       { headers: { 'Content-Type': 'application/json' } }
     )
   })
   ```

2. **Configura Cron Job Esterno**:
   - Usa [cron-job.org](https://cron-job.org) o simile
   - URL: `https://tuo-progetto.supabase.co/functions/v1/handle-waitlist-timeout`
   - Schedule: Ogni 5 minuti
   - Headers: `Authorization: Bearer TUO_ANON_KEY`

### Opzione 2: pg_cron (se disponibile)

```sql
-- Abilita pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Crea job che esegue ogni 5 minuti
SELECT cron.schedule(
    'handle-waitlist-timeout',
    '*/5 * * * *', -- Ogni 5 minuti
    $$SELECT public.handle_waitlist_notification_timeout()$$
);
```

### Opzione 3: Supabase Scheduled Functions (Beta)

Se disponibile nella tua istanza Supabase, usa le Scheduled Functions native.

---

## 📊 Configurazione Dashboard Staff

La dashboard è già integrata nell'app. Per accedervi:

1. Login come staff/admin
2. Vai su "Lista d'Attesa" nel menu laterale
3. La dashboard mostra:
   - Statistiche generali (in attesa, notificati, prenotati, conversion rate)
   - Statistiche per data
   - Lista completa entry waitlist
   - Filtro per data

---

## 🔔 Notifiche Staff

Le notifiche staff vengono create automaticamente quando:

1. **Nuovo cliente si iscrive** e ci sono già >3 clienti in coda
2. **Ci sono >5 clienti in waitlist** (summary periodico)

Per attivare il summary periodico, configura un job schedulato che chiama:

```sql
SELECT public.notify_staff_waitlist_summary();
```

**Schedule consigliato**: Ogni ora o giornalmente alle 9:00

---

## ✅ Verifica Setup

### Test Timeout

1. Crea una waitlist entry
2. Cancella un appuntamento per quella data
3. Verifica che il primo cliente riceva notifica
4. Aspetta 15 minuti (o modifica `notification_expires_at` manualmente per test)
5. Verifica che il prossimo cliente riceva notifica

### Test Email

1. Verifica che il webhook Supabase sia configurato
2. Cancella un appuntamento
3. Controlla N8N che il webhook sia stato chiamato
4. Verifica che l'email sia stata inviata

### Test Dashboard

1. Login come staff
2. Vai su "Lista d'Attesa"
3. Verifica che le statistiche siano corrette
4. Testa filtro per data

### Test Notifiche Staff

1. Iscrivi >3 clienti alla waitlist
2. Verifica che staff riceva notifica
3. Verifica che notifica appaia nel pannello notifiche

---

## 🐛 Troubleshooting

### Email non vengono inviate

1. Verifica che webhook Supabase sia configurato correttamente
2. Controlla logs N8N per errori
3. Verifica che URL webhook sia corretto
4. Controlla che token di autenticazione sia valido

### Timeout non funziona

1. Verifica che job schedulato sia attivo
2. Controlla logs Supabase per errori nella funzione
3. Verifica che `notification_expires_at` sia impostato correttamente
4. Testa manualmente: `SELECT public.handle_waitlist_notification_timeout();`

### Dashboard non carica dati

1. Verifica che RLS policies permettano a staff di vedere waitlist
2. Controlla console browser per errori
3. Verifica che `shop_id` sia corretto
4. Controlla network tab per errori API

---

## 📝 Note Importanti

1. **Timeout**: Il timeout di 15 minuti è configurabile modificando `INTERVAL '15 minutes'` nello script SQL
2. **Webhook**: Se pg_net non è disponibile, usa Supabase Webhooks (Opzione A)
3. **Performance**: Il job timeout dovrebbe essere eseguito ogni 5 minuti per garantire risposta rapida
4. **Email**: Assicurati che il template email sia responsive per mobile
5. **Privacy**: Le email contengono link diretti alla prenotazione - assicurati che siano sicuri

---

## 🎯 Prossimi Passi

Dopo aver completato il setup:

1. Monitora conversioni waitlist → prenotazioni
2. Ajusta timeout se necessario (15 minuti potrebbe essere troppo/poco)
3. Analizza statistiche nella dashboard
4. Considera aggiungere SMS notifications per clienti VIP
5. Implementa auto-prenotazione per clienti frequenti

