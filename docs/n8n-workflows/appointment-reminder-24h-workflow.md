# Workflow N8N: Reminder 24h Appuntamenti

## Panoramica

Questo workflow N8N invia promemoria WhatsApp 24 ore prima degli appuntamenti.

## Architettura

Il sistema usa un **approccio ibrido**:
1. **Trigger Supabase**: Cattura appuntamenti creati/aggiornati quando sono già nella finestra 24h
2. **Job N8N Periodico**: Cerca appuntamenti che sono entrati nella finestra 24h

## Workflow 1: Webhook da Trigger Supabase

### Nodi

1. **Webhook** (Trigger)
   - **Nome**: `appointment-reminder-24h`
   - **Method**: POST
   - **Path**: `/webhook/appointment-reminder-24h`
   - **Authentication**: Header `Authorization: Bearer poltrona_secret_24h`

2. **Extract Data**
   - Estrai `id` dell'appuntamento dal body della richiesta
   - Il trigger Supabase invia i dati dell'appuntamento nel body

3. **HTTP Request - Get Appointment Details**
   - **Method**: GET
   - **URL**: `https://<TUO_PROJECT>.supabase.co/rest/v1/appointments?id=eq.{{$json.id}}&select=*,clients(*),services(*),staff(*),shops(*)`
   - **Headers**:
     - `apikey: <SERVICE_ROLE_KEY>`
     - `Authorization: Bearer <SERVICE_ROLE_KEY>`
     - `Content-Type: application/json`

4. **Check reminder_24h_sent**
   - **IF** `reminder_24h_sent = true` → **STOP** (già inviato)
   - **IF** `reminder_24h_sent = false` → Continua

5. **Calculate Time Window**
   - Verifica che `start_at` sia tra 23h e 25h nel futuro
   - Se non è nella finestra, **STOP**

6. **Send WhatsApp**
   - Usa il tuo provider WhatsApp (Twilio, WhatsApp Cloud API, ecc.)
   - **To**: `{{$json.clients.phone_e164}}`
   - **Message**: Template con:
     - Nome cliente
     - Data/ora appuntamento
     - Nome servizio
     - Nome barbiere
     - Nome negozio

7. **Update reminder_24h_sent**
   - **Method**: PATCH
   - **URL**: `https://<TUO_PROJECT>.supabase.co/rest/v1/appointments?id=eq.{{$json.id}}`
   - **Headers**: Stessi del nodo 3
   - **Body**:
     ```json
     {
       "reminder_24h_sent": true
     }
     ```

## Workflow 2: Job Periodico (CRON)

### Nodi

1. **Cron** (Trigger)
   - **Cron Expression**: `0 * * * *` (ogni ora) oppure `0 10 * * *` (ogni giorno alle 10:00)
   - **Timezone**: Europe/Rome (o il tuo timezone)

2. **Calculate Time Window**
   - **Function Node** o **Set Node**:
     ```javascript
     const now = new Date();
     const from = new Date(now.getTime() + 23 * 60 * 60 * 1000); // +23h
     const to = new Date(now.getTime() + 25 * 60 * 60 * 1000); // +25h
     
     return {
       from: from.toISOString(),
       to: to.toISOString()
     };
     ```

3. **HTTP Request - Get Appointments**
   - **Method**: GET
   - **URL**: `https://<TUO_PROJECT>.supabase.co/rest/v1/appointments`
   - **Query Parameters**:
     - `select=*,clients(*),services(*),staff(*),shops(*)`
     - `status=in.(scheduled,confirmed,rescheduled)`
     - `reminder_24h_sent=eq.false`
     - `start_at=gte.{{$json.from}}`
     - `start_at=lte.{{$json.to}}`
   - **Headers**:
     - `apikey: <SERVICE_ROLE_KEY>`
     - `Authorization: Bearer <SERVICE_ROLE_KEY>`
     - `Content-Type: application/json`

4. **Split In Batches**
   - **Batch Size**: 1
   - Processa un appuntamento alla volta

5. **Send WhatsApp**
   - Stesso del Workflow 1, nodo 6

6. **Update reminder_24h_sent**
   - Stesso del Workflow 1, nodo 7

7. **Error Handling**
   - Se l'invio WhatsApp fallisce, **NON** aggiornare `reminder_24h_sent`
   - Logga l'errore per debugging

## Template Messaggio WhatsApp

```
Ciao {{$json.clients.first_name}}! 👋

Ti ricordiamo che hai un appuntamento domani:

📅 Data: {{formatDate($json.start_at, 'DD/MM/YYYY')}}
🕐 Ora: {{formatDate($json.start_at, 'HH:mm')}}
💇 Servizio: {{$json.services.name}}
👨‍💼 Barbiere: {{$json.staff.full_name}}
🏪 Negozio: {{$json.shops.name}}

Ti aspettiamo! 🎉

Per modifiche o cancellazioni, rispondi a questo messaggio.
```

## Variabili d'Ambiente N8N

Configura queste variabili in N8N:

- `SUPABASE_URL`: `https://<TUO_PROJECT>.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY`: La tua service role key
- `WHATSAPP_API_KEY`: Chiave API del tuo provider WhatsApp
- `WHATSAPP_PHONE_NUMBER`: Numero WhatsApp Business

## Test

1. **Test Trigger**:
   - Crea un appuntamento con `start_at` = ora + 24h
   - Verifica che il webhook venga chiamato
   - Controlla che `reminder_24h_sent` venga aggiornato

2. **Test Job Periodico**:
   - Crea un appuntamento con `start_at` = ora + 2 giorni
   - Attendi che entri nella finestra 24h
   - Verifica che il job lo trovi e invii il messaggio

## Troubleshooting

- **Messaggi duplicati**: Verifica che `reminder_24h_sent` venga sempre aggiornato dopo l'invio
- **Messaggi non inviati**: Controlla i log N8N e verifica che il job periodico giri correttamente
- **Finestra temporale sbagliata**: Verifica il timezone in N8N e Supabase



