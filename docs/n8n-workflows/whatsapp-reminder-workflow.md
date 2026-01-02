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
reminder_sent=eq.false
start_at=gte.{{$json.start}}
start_at=lt.{{$json.end}}
```

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

#### 6. Format Message

**Tipo**: Code (Function Node)

**Codice JavaScript**:
```javascript
const appointment = $input.item.json;
const client = appointment.clients || {};
const service = appointment.services || {};
const staff = appointment.staff || {};
const shop = appointment.shops || {};

// Formatta data e ora
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

// Costruisci messaggio
const message = `Ciao ${client.first_name || 'Cliente'}! 👋

Ti ricordiamo che hai un appuntamento domani:

📅 Data: ${dateStr}
🕐 Ora: ${timeStr}
💇 Servizio: ${service.name || 'N/A'}
👨‍💼 Barbiere: ${staff.full_name || 'N/A'}
🏪 Negozio: ${shop.name || 'N/A'}

Ti aspettiamo! 🎉

Per modifiche o cancellazioni, rispondi a questo messaggio.`;

return {
  ...appointment,
  formatted_message: message,
  phone_number: client.phone_e164,
  phone_number_id: shop.whatsapp_phone_number_id || $env.WHATSAPP_PHONE_NUMBER_ID,
  access_token: shop.whatsapp_access_token || $env.WHATSAPP_ACCESS_TOKEN
};
```

**Output**: Appuntamento con messaggio formattato e credenziali WhatsApp

---

#### 7. Send WhatsApp Message

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

**Body (JSON)**:
```json
{
  "messaging_product": "whatsapp",
  "to": "{{$json.phone_number}}",
  "type": "text",
  "text": {
    "body": "{{$json.formatted_message}}"
  }
}
```

**Note**:
- Usa WhatsApp Cloud API v18.0 (verifica versione più recente)
- Il numero deve essere in formato E.164 (es. +393491234567)
- Per messaggi fuori dalla finestra 24h, devi usare template approvati da Meta

**Gestione Errori**:
- Se l'invio fallisce, il workflow continua ma NON aggiorna `reminder_sent`
- Questo permette retry automatico al prossimo run

---

#### 8. Check Send Success

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

#### 9. Update Reminder Sent

**Tipo**: HTTP Request

**Configurazione**:
- **Method**: `PATCH`
- **URL**: `https://{{$env.SUPABASE_PROJECT}}.supabase.co/rest/v1/appointments?id=eq.{{$json.id}}`
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
  "reminder_sent": true,
  "reminder_sent_at": "{{$now}}"
}
```

**Note**:
- Aggiorna solo se l'invio WhatsApp ha avuto successo
- Usa `return=minimal` per risparmiare bandwidth

---

#### 10. Log Error (Opzionale)

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
