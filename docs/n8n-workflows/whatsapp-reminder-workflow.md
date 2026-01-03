# Workflow N8N: Reminder WhatsApp Appuntamenti

## Panoramica

Questo workflow N8N invia promemoria WhatsApp automatici ogni giorno alle 20:00 (orario configurabile) per tutti gli appuntamenti del giorno successivo. Il sistema è progettato per essere semplice, affidabile e facile da configurare.

## Architettura

Il workflow usa un **approccio basato su job CRON**:
- Un job che gira ogni giorno alle 20:00 (o orario configurato)
- Cerca tutti gli appuntamenti del giorno successivo
- Filtra quelli che non hanno ancora ricevuto reminder
- Invia messaggi WhatsApp ai clienti
- Aggiorna il flag `reminder_sent` dopo l'invio riuscito

## Workflow: Job Reminder Giornaliero

### Nodi del Workflow

#### 1. Cron Trigger

**Tipo**: Cron

**Configurazione**:
- **Cron Expression**: `0 20 * * *` (ogni giorno alle 20:00)
- **Timezone**: `Europe/Rome` (o il timezone del tuo negozio)
- **Activation**: `On App Start` (opzionale, per test immediato)

**Note**:
- Per testare, puoi temporaneamente cambiare l'espressione a `*/5 * * * *` (ogni 5 minuti)
- L'orario può essere personalizzato per negozio, ma inizialmente usiamo un orario globale

---

#### 2. Calculate Tomorrow Date

**Tipo**: Code (Function Node)

**Codice JavaScript**:
```javascript
// Calcola la data di domani (inizio e fine giornata)
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
tomorrow.setHours(0, 0, 0, 0); // Inizio domani (00:00:00)

const nextDay = new Date(tomorrow);
nextDay.setDate(nextDay.getDate() + 1); // Fine domani (00:00:00 del giorno dopo)

return {
  start: tomorrow.toISOString(),
  end: nextDay.toISOString(),
  date_display: tomorrow.toLocaleDateString('it-IT', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
};
```

**Output**:
```json
{
  "start": "2024-01-15T00:00:00.000Z",
  "end": "2024-01-16T00:00:00.000Z",
  "date_display": "lunedì, 15 gennaio 2024"
}
```

---

#### 3. HTTP Request - Get Appointments

**Tipo**: HTTP Request

**Configurazione**:
- **Method**: `GET`
- **URL**: `https://{{$env.SUPABASE_PROJECT}}.supabase.co/rest/v1/appointments`
- **Authentication**: `Generic Credential Type`
  - **Name**: `Supabase Service Role`
  - **Header Name**: `apikey`
  - **Header Value**: `{{$env.SUPABASE_SERVICE_ROLE_KEY}}`

**Query Parameters**:
```
select=*,clients(*),services(*),staff(*),shops(*)
status=in.(scheduled,confirmed,rescheduled)
start_at=gte.{{$json.start}}
start_at=lt.{{$json.end}}
```

**Note**:
- Non filtriamo più per `reminder_sent=eq.false` perché usiamo `whatsapp_outbox`
- Il filtro per reminder già inviati viene fatto nel nodo 4b-4c

**Headers**:
```
apikey: {{$env.SUPABASE_SERVICE_ROLE_KEY}}
Authorization: Bearer {{$env.SUPABASE_SERVICE_ROLE_KEY}}
Content-Type: application/json
Prefer: return=representation
```

**Note**:
- La query usa PostgREST syntax di Supabase
- `select=*,clients(*),services(*),staff(*),shops(*)` fa join automatici per ottenere tutti i dati necessari
- Filtra solo appuntamenti con `reminder_sent = false` per evitare duplicati

---

#### 4. Filter Appointments

**Tipo**: IF (Conditional Node)

**Condizioni**:
1. **Cliente ha numero WhatsApp**:
   - `{{$json.clients.phone_e164}}` esiste e non è vuoto
   - `{{$json.clients.phone_e164}}` non è null

2. **Non è walk-in**:
   - `{{$json.client_id}}` non è null

3. **Reminder abilitato per negozio** (opzionale):
   - `{{$json.shops.whatsapp_reminder_enabled}}` è true o null (default true)

**Espressione**:
```
{{$json.clients && $json.clients.phone_e164 && $json.client_id && ($json.shops.whatsapp_reminder_enabled !== false)}}
```

**Output**: Solo appuntamenti validi per invio reminder

---

#### 4b. Check Existing Outbox Entry (Nuovo)

**Tipo**: HTTP Request

**Configurazione**:
- **Method**: `GET`
- **URL**: `https://{{$env.SUPABASE_PROJECT}}.supabase.co/rest/v1/whatsapp_outbox?appointment_id=eq.{{$json.id}}&reminder_type=eq.daily&select=id,status`
- **Authentication**: Stessa del nodo 3

**Note**:
- Verifica se esiste già un record in `whatsapp_outbox` per questo appuntamento con `reminder_type='daily'`
- Se esiste e `status='sent'`, salta l'invio (già inviato)
- Se esiste e `status='pending'` o `status='failed'`, procedi con retry

---

#### 4c. Filter Already Sent (Nuovo)

**Tipo**: IF (Conditional Node)

**Condizione**:
- Se la query precedente ha trovato un record con `status='sent'`, salta

**Espressione**:
```
{{!$json || $json.length === 0 || $json[0].status !== 'sent'}}
```

**Output**: Solo appuntamenti che non hanno ancora ricevuto reminder inviato con successo

---

#### 5. Split In Batches

**Tipo**: Split In Batches

**Configurazione**:
- **Batch Size**: `1` (processa un appuntamento alla volta)
- **Options**: 
  - Reset: `false`
  - Keep Only Set Items: `true`

**Note**:
- Processare uno alla volta evita rate limiting di WhatsApp Cloud API
- Permette gestione errori più granulare

---

#### 6. Create Outbox Entry (Nuovo)

**Tipo**: HTTP Request

**Configurazione**:
- **Method**: `POST`
- **URL**: `https://{{$env.SUPABASE_PROJECT}}.supabase.co/rest/v1/whatsapp_outbox`
- **Authentication**: Stessa del nodo 3

**Headers**:
```
apikey: {{$env.SUPABASE_SERVICE_ROLE_KEY}}
Authorization: Bearer {{$env.SUPABASE_SERVICE_ROLE_KEY}}
Content-Type: application/json
Prefer: return=representation
```

**Body (JSON)**:
```json
{
  "appointment_id": "{{$json.id}}",
  "shop_id": "{{$json.shop_id}}",
  "client_id": "{{$json.client_id}}",
  "to_phone": "{{$json.clients.phone_e164}}",
  "reminder_type": "daily",
  "status": "pending",
  "attempts": 0
}
```

**Note**:
- Crea un record in `whatsapp_outbox` con status 'pending'
- L'indice unico `uq_whatsapp_outbox_appt_type` previene duplicati
- Se il record esiste già, questa chiamata fallirà (usa `ON CONFLICT` o verifica prima)

**Alternativa con ON CONFLICT** (se supportato da Supabase):
```sql
INSERT INTO whatsapp_outbox (appointment_id, shop_id, client_id, to_phone, reminder_type, status, attempts)
VALUES (...)
ON CONFLICT (appointment_id, reminder_type) 
DO UPDATE SET 
  status = 'pending',
  attempts = whatsapp_outbox.attempts + 1,
  last_error = NULL;
```

---

#### 7. Format Message Data

**Tipo**: Code (Function Node)

**Codice JavaScript**:
```javascript
const appointment = $input.item.json;
const client = appointment.clients || {};
const service = appointment.services || {};
const staff = appointment.staff || {};
const shop = appointment.shops || {};

// Formatta data e ora per template WhatsApp
const startDate = new Date(appointment.start_at);
const dateStr = startDate.toLocaleDateString('it-IT', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric'
});
const timeStr = startDate.toLocaleTimeString('it-IT', {
  hour: '2-digit',
  minute: '2-digit'
});

// Formatta data semplice (DD/MM/YYYY) per template
const dateSimple = startDate.toLocaleDateString('it-IT', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric'
});

return {
  ...appointment,
  phone_number: client.phone_e164,
  phone_number_id: shop.whatsapp_phone_number_id || $env.WHATSAPP_PHONE_NUMBER_ID,
  access_token: shop.whatsapp_access_token || $env.WHATSAPP_ACCESS_TOKEN,
  outbox_id: appointment.outbox_id || null,
  // Dati formattati per template WhatsApp
  appointment_date_formatted: dateSimple, // Es: "15/01/2024"
  appointment_time_formatted: timeStr, // Es: "14:30"
  appointment_date_full: dateStr, // Es: "lunedì, 15 gennaio 2024"
  client_first_name: client.first_name || 'Cliente',
  service_name: service.name || 'N/A',
  staff_name: staff.full_name || 'N/A',
  shop_name: shop.name || 'N/A'
};
```

**Output**: Appuntamento con dati formattati per template WhatsApp e credenziali

---

#### 8. Send WhatsApp Message

**⚠️ REGOLA FONDAMENTALE WHATSAPP**: 
Se il cliente non ti ha scritto nelle ultime 24 ore, WhatsApp richiede TEMPLATE approvati. Devi usare `type=template` (NON `type=text`). Punto.

**Tipo**: HTTP Request

**Configurazione**:
- **Method**: `POST`
- **URL**: `https://graph.facebook.com/v18.0/{{$json.phone_number_id}}/messages`
- **Authentication**: `Generic Credential Type`
  - **Name**: `WhatsApp Cloud API`
  - **Header Name**: `Authorization`
  - **Header Value**: `Bearer {{$json.access_token}}`

**Headers**:
```
Authorization: Bearer {{$json.access_token}}
Content-Type: application/json
```

**Body (JSON) - USARE SEMPRE TEMPLATE**:
```json
{
  "messaging_product": "whatsapp",
  "to": "{{$json.phone_number}}",
  "type": "template",
  "template": {
    "name": "appointment_reminder",
    "language": {
      "code": "it"
    },
    "components": [
      {
        "type": "body",
        "parameters": [
          {
            "type": "text",
            "text": "{{$json.clients.first_name}}"
          },
          {
            "type": "text",
            "text": "{{$json.appointment_date_formatted}}"
          },
          {
            "type": "text",
            "text": "{{$json.appointment_time_formatted}}"
          },
          {
            "type": "text",
            "text": "{{$json.services.name}}"
          },
          {
            "type": "text",
            "text": "{{$json.staff.full_name}}"
          },
          {
            "type": "text",
            "text": "{{$json.shops.name}}"
          }
        ]
      }
    ]
  }
}
```

**Note IMPORTANTI**:
- ⚠️ **SEMPRE usare `type=template`** per reminder (il cliente non ha scritto nelle ultime 24h)
- Il template `appointment_reminder` deve essere **approvato da Meta** prima dell'uso
- Il numero deve essere in formato E.164 (es. +393491234567)
- Usa WhatsApp Cloud API v18.0 (verifica versione più recente)
- Il template deve essere creato e approvato in Meta Business Manager

**Gestione Errori**:
- Se l'invio fallisce, il workflow continua ma NON aggiorna lo status in `whatsapp_outbox`
- Questo permette retry automatico al prossimo run
- Se ricevi errore "template not found", il template non è ancora approvato

---

#### 9. Check Send Success

**Tipo**: IF (Conditional Node)

**Condizione**:
- Status code HTTP è `200` o `201`
- Response contiene `messages` array con almeno un elemento

**Espressione**:
```
{{$json.statusCode === 200 || $json.statusCode === 201}}
```

**Output**:
- **True**: Invia a nodo "Update Reminder Sent"
- **False**: Invia a nodo "Log Error"

---

#### 10. Update Outbox on Success

**Tipo**: HTTP Request

**Configurazione**:
- **Method**: `PATCH`
- **URL**: `https://{{$env.SUPABASE_PROJECT}}.supabase.co/rest/v1/whatsapp_outbox?id=eq.{{$json.outbox_id}}`
- **Authentication**: Stessa del nodo 3

**Headers**:
```
apikey: {{$env.SUPABASE_SERVICE_ROLE_KEY}}
Authorization: Bearer {{$env.SUPABASE_SERVICE_ROLE_KEY}}
Content-Type: application/json
Prefer: return=minimal
```

**Body (JSON)**:
```json
{
  "status": "sent",
  "sent_at": "{{$now}}",
  "provider_message_id": "{{$json.messages[0].id}}",
  "attempts": "{{$json.attempts || 0}} + 1"
}
```

**Note**:
- Aggiorna lo status a 'sent' solo se l'invio WhatsApp ha avuto successo
- Salva il `provider_message_id` restituito da WhatsApp Cloud API
- Incrementa il contatore `attempts`
- Usa `return=minimal` per risparmiare bandwidth

**Alternativa**: Se non hai `outbox_id` nel JSON, usa:
```
https://{{$env.SUPABASE_PROJECT}}.supabase.co/rest/v1/whatsapp_outbox?appointment_id=eq.{{$json.id}}&reminder_type=eq.daily
```

---

#### 10b. Update Appointments Flag (Opzionale - Retrocompatibilità)

**Tipo**: HTTP Request

**Configurazione**:
- **Method**: `PATCH`
- **URL**: `https://{{$env.SUPABASE_PROJECT}}.supabase.co/rest/v1/appointments?id=eq.{{$json.id}}`
- **Authentication**: Stessa del nodo 3

**Body (JSON)**:
```json
{
  "reminder_sent": true,
  "reminder_sent_at": "{{$now}}"
}
```

**Note**:
- Questo nodo è opzionale e serve solo per retrocompatibilità
- Se usi solo `whatsapp_outbox`, puoi rimuovere questo nodo

---

#### 11. Update Outbox on Failure

**Tipo**: HTTP Request

**Configurazione**:
- **Method**: `PATCH`
- **URL**: `https://{{$env.SUPABASE_PROJECT}}.supabase.co/rest/v1/whatsapp_outbox?appointment_id=eq.{{$json.id}}&reminder_type=eq.daily`
- **Authentication**: Stessa del nodo 3

**Body (JSON)**:
```json
{
  "status": "failed",
  "last_error": "{{JSON.stringify($json.error || $json.body)}}",
  "attempts": "{{($json.attempts || 0) + 1}}"
}
```

**Note**:
- Aggiorna lo status a 'failed' se l'invio è fallito
- Salva l'errore in `last_error` per debugging
- Incrementa il contatore `attempts` per tracciare i tentativi

---

#### 12. Log Error (Opzionale)

**Tipo**: Code (Function Node) o Webhook per logging esterno

**Codice JavaScript**:
```javascript
const error = $input.item.json;
console.error('❌ Errore invio WhatsApp:', {
  appointment_id: error.id,
  client_phone: error.phone_number,
  error: error.error || error.body,
  timestamp: new Date().toISOString()
});

// Opzionale: invia a servizio di logging (Sentry, Logtail, etc.)
// await fetch('https://your-logging-service.com', {
//   method: 'POST',
//   body: JSON.stringify({ error, appointment_id: error.id })
// });

return error;
```

---

## Variabili d'Ambiente N8N

Configura queste variabili in N8N (Settings → Environment Variables):

### Obbligatorie:
- `SUPABASE_PROJECT`: Il tuo project ID Supabase (es. `abcdefghijklmnop`)
- `SUPABASE_SERVICE_ROLE_KEY`: La tua service role key Supabase
- `WHATSAPP_PHONE_NUMBER_ID`: Phone Number ID di WhatsApp Cloud API
- `WHATSAPP_ACCESS_TOKEN`: Access Token permanente di WhatsApp Cloud API

### Opzionali:
- `WHATSAPP_API_VERSION`: Versione API (default: `v18.0`)

## Test del Workflow

### Test Manuale

1. **Disabilita temporaneamente il CRON**:
   - Cambia `0 20 * * *` a `*/5 * * * *` (ogni 5 minuti) per test immediato

2. **Crea appuntamento di test**:
   ```sql
   INSERT INTO appointments (shop_id, client_id, staff_id, service_id, start_at, end_at, status, reminder_sent)
   VALUES (
     'shop-uuid',
     'client-uuid',
     'staff-uuid',
     'service-uuid',
     NOW() + INTERVAL '1 day', -- Domani
     NOW() + INTERVAL '1 day' + INTERVAL '30 minutes',
     'scheduled',
     false
   );
   ```

3. **Esegui workflow manualmente**:
   - Clicca "Execute Workflow" in n8n
   - Verifica che il messaggio venga inviato
   - Controlla che `reminder_sent` venga aggiornato

4. **Verifica log**:
   - Controlla i log di n8n per eventuali errori
   - Verifica che il messaggio arrivi al cliente

### Test Produzione

1. **Ripristina CRON originale**: `0 20 * * *`
2. **Monitora per alcuni giorni**:
   - Verifica che i reminder vengano inviati correttamente
   - Controlla che non ci siano duplicati
   - Monitora eventuali errori

## Troubleshooting

### Messaggi non inviati

**Possibili cause**:
1. **Numero WhatsApp non valido**: Verifica formato E.164
2. **Token scaduto**: Rigenera Access Token in Meta Business
3. **Rate limiting**: WhatsApp ha limiti di invio (1000 messaggi/giorno per numero di test)
4. **Template non approvato**: Per messaggi fuori 24h serve template approvato

**Soluzione**:
- Controlla log n8n per errori specifici
- Verifica credenziali WhatsApp Cloud API
- Testa invio manuale con curl o Postman

### Messaggi duplicati

**Possibili cause**:
1. **Flag `reminder_sent` non aggiornato**: Errore nell'aggiornamento Supabase
2. **Workflow eseguito più volte**: Verifica che il CRON non sia duplicato

**Soluzione**:
- Verifica che il nodo "Update Reminder Sent" venga eseguito correttamente
- Aggiungi log per tracciare quando viene aggiornato il flag

### Appuntamenti saltati

**Possibili cause**:
1. **Filtro troppo restrittivo**: Verifica condizioni nel nodo "Filter Appointments"
2. **Query Supabase errata**: Verifica parametri della query

**Soluzione**:
- Aggiungi log per vedere quanti appuntamenti vengono trovati
- Verifica che i filtri siano corretti

## Ottimizzazioni Future

- **Batch processing**: Invece di uno alla volta, processare in batch (con rate limiting)
- **Retry automatico**: Implementare retry con backoff esponenziale
- **Notifiche admin**: Inviare notifica se troppi errori
- **Statistiche**: Tracciare tasso di successo invii
- **Personalizzazione orario**: Supportare orari diversi per negozio

## Note Importanti

- **Sicurezza**: I token devono essere in variabili ambiente, non hardcoded
- **Consenso**: Assicurati che i clienti abbiano dato consenso per WhatsApp
- **GDPR**: Rispetta le normative sulla privacy
- **Rate Limiting**: WhatsApp ha limiti di invio, monitora l'utilizzo
- **Template Approval**: Per produzione, usa template approvati da Meta
