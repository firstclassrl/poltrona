# Workflow N8N: Reminder Appuntamenti Giornaliero

Questo workflow invia reminder via email e WhatsApp ai clienti il giorno prima dell'appuntamento.

## Trigger

**Schedule Trigger (CRON)** - Ogni giorno alle 10:00

```
0 10 * * *
```

## Struttura Workflow N8N

```
[Schedule Trigger: 10:00 ogni giorno]
            ↓
[Supabase: Query Appuntamenti Domani]
            ↓
[Split In Batches]
            ↓
      [IF: Ha Email?]
        ↓       ↓
      [Yes]   [No]
        ↓
    [Send Email]
            ↓
      [IF: Ha WhatsApp?]
        ↓       ↓
      [Yes]   [No]
        ↓
    [Send WhatsApp]
```

## Nodi del Workflow

### 1. Schedule Trigger

```json
{
  "node": "Schedule Trigger",
  "parameters": {
    "rule": {
      "interval": [
        {
          "field": "cronExpression",
          "expression": "0 10 * * *"
        }
      ]
    }
  }
}
```

### 2. Supabase - Query Appuntamenti Domani

```sql
SELECT 
  a.id as appointment_id,
  a.start_at,
  a.notes,
  a.status,
  c.id as client_id,
  c.first_name as client_first_name,
  c.last_name as client_last_name,
  c.phone_e164 as client_phone,
  c.email as client_email,
  s.full_name as staff_name,
  sv.name as service_name,
  sv.duration_min,
  sv.price_cents,
  sh.name as shop_name,
  sh.address as shop_address,
  sh.phone as shop_phone,
  sh.whatsapp as shop_whatsapp
FROM appointments a
LEFT JOIN clients c ON a.client_id = c.id
LEFT JOIN staff s ON a.staff_id = s.id
LEFT JOIN services sv ON a.service_id = sv.id
LEFT JOIN shops sh ON a.shop_id = sh.id
WHERE 
  DATE(a.start_at) = DATE(NOW() + INTERVAL '1 day')
  AND a.status NOT IN ('cancelled', 'no_show', 'completed')
ORDER BY a.start_at ASC
```

### 3. Code Node - Prepara Dati

```javascript
// Per ogni appuntamento, prepara i dati formattati
const appointments = $input.all();

return appointments.map(item => {
  const data = item.json;
  const appointmentDate = new Date(data.start_at);
  
  const dateFormatted = appointmentDate.toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
  
  const timeFormatted = appointmentDate.toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  const clientName = `${data.client_first_name} ${data.client_last_name || ''}`.trim();
  const price = data.price_cents ? (data.price_cents / 100).toFixed(2) + ' €' : '';
  
  // Pulisci numero WhatsApp (rimuovi spazi, assicura formato E164)
  let whatsappNumber = data.client_phone || '';
  whatsappNumber = whatsappNumber.replace(/\s+/g, '');
  if (!whatsappNumber.startsWith('+')) {
    whatsappNumber = '+39' + whatsappNumber;
  }
  
  return {
    json: {
      ...data,
      client_name: clientName,
      date_formatted: dateFormatted,
      time_formatted: timeFormatted,
      price_formatted: price,
      whatsapp_number: whatsappNumber,
      has_email: !!data.client_email,
      has_whatsapp: !!data.client_phone
    }
  };
});
```

### 4. IF Node - Verifica Email

```json
{
  "conditions": {
    "boolean": [
      {
        "value1": "={{$json.has_email}}",
        "value2": true
      }
    ]
  }
}
```

### 5. Send Email Reminder

**Oggetto:** `⏰ Promemoria: Appuntamento domani alle {{$json.time_formatted}}`

**Corpo HTML:**

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; color: #333; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #f59e0b, #d97706); padding: 30px; text-align: center; }
    .header h1 { margin: 0; color: white; font-size: 24px; }
    .header .icon { font-size: 48px; margin-bottom: 10px; }
    .content { padding: 30px; }
    .appointment-card { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 0 10px 10px 0; }
    .detail { margin: 10px 0; display: flex; align-items: center; }
    .detail-icon { width: 24px; margin-right: 10px; }
    .detail-label { color: #666; min-width: 80px; }
    .detail-value { font-weight: bold; color: #1a1a2e; }
    .cta { text-align: center; margin: 30px 0; }
    .cta a { display: inline-block; background: #f59e0b; color: white; padding: 15px 30px; border-radius: 25px; text-decoration: none; font-weight: bold; }
    .footer { background: #f5f5f5; padding: 20px; text-align: center; color: #888; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="icon">✂️</div>
      <h1>Promemoria Appuntamento</h1>
    </div>
    <div class="content">
      <p>Ciao <strong>{{$json.client_name}}</strong>!</p>
      <p>Ti ricordiamo che hai un appuntamento prenotato per <strong>domani</strong>:</p>
      
      <div class="appointment-card">
        <div class="detail">
          <span class="detail-icon">📅</span>
          <span class="detail-label">Data:</span>
          <span class="detail-value">{{$json.date_formatted}}</span>
        </div>
        <div class="detail">
          <span class="detail-icon">⏰</span>
          <span class="detail-label">Ora:</span>
          <span class="detail-value">{{$json.time_formatted}}</span>
        </div>
        <div class="detail">
          <span class="detail-icon">💈</span>
          <span class="detail-label">Servizio:</span>
          <span class="detail-value">{{$json.service_name}}</span>
        </div>
        <div class="detail">
          <span class="detail-icon">👤</span>
          <span class="detail-label">Con:</span>
          <span class="detail-value">{{$json.staff_name}}</span>
        </div>
        {{#if $json.price_formatted}}
        <div class="detail">
          <span class="detail-icon">💰</span>
          <span class="detail-label">Prezzo:</span>
          <span class="detail-value">{{$json.price_formatted}}</span>
        </div>
        {{/if}}
      </div>
      
      <p>📍 <strong>{{$json.shop_name}}</strong><br>
      {{$json.shop_address}}</p>
      
      <p>Se hai bisogno di modificare o cancellare l'appuntamento, contattaci al <strong>{{$json.shop_phone}}</strong></p>
      
      <p>Ti aspettiamo! 💈</p>
    </div>
    <div class="footer">
      <p>{{$json.shop_name}}</p>
      <p>Questa email è stata inviata automaticamente.</p>
    </div>
  </div>
</body>
</html>
```

### 6. IF Node - Verifica WhatsApp

```json
{
  "conditions": {
    "boolean": [
      {
        "value1": "={{$json.has_whatsapp}}",
        "value2": true
      }
    ]
  }
}
```

### 7. Send WhatsApp (Twilio)

**Configurazione Twilio WhatsApp Node:**

```json
{
  "node": "Twilio",
  "parameters": {
    "operation": "send",
    "from": "whatsapp:+14155238886",
    "to": "whatsapp:{{$json.whatsapp_number}}",
    "message": "template_message"
  }
}
```

**Template WhatsApp (deve essere pre-approvato da Meta):**

Nome template: `appointment_reminder`

```
🗓️ *Promemoria Appuntamento*

Ciao {{1}}! 👋

Ti ricordiamo il tuo appuntamento per *domani*:

📅 *Data:* {{2}}
⏰ *Ora:* {{3}}
💈 *Servizio:* {{4}}
👤 *Con:* {{5}}

📍 {{6}}

Per modifiche o cancellazioni, rispondi a questo messaggio o chiamaci.

Ti aspettiamo! ✂️
```

**Parametri template:**
1. `{{$json.client_name}}`
2. `{{$json.date_formatted}}`
3. `{{$json.time_formatted}}`
4. `{{$json.service_name}}`
5. `{{$json.staff_name}}`
6. `{{$json.shop_name}}`

## Configurazione Twilio WhatsApp

### 1. Setup Account Twilio

1. Registrati su [twilio.com](https://www.twilio.com)
2. Vai su **Messaging > Try it out > Send a WhatsApp message**
3. Segui la guida sandbox per testare
4. Per produzione: richiedi accesso WhatsApp Business API

### 2. Template WhatsApp

I template devono essere approvati da Meta. Per creare un template:

1. Vai su Twilio Console > Messaging > Content Template Builder
2. Crea nuovo template con categoria "UTILITY" o "MARKETING"
3. Attendi approvazione (24-48h)

### 3. Credenziali N8N

```
Account SID: ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Auth Token: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
From Number: whatsapp:+14155238886 (sandbox) o tuo numero verificato
```

## Alternative a Twilio

### 360dialog

- Costo inferiore
- Buona integrazione N8N
- Supporto italiano

### Meta Business API (diretto)

- Gratuito per 1000 conversazioni/mese
- Setup più complesso
- Richiede Meta Business Manager

## Credenziali Necessarie

1. **Supabase**
   - URL progetto
   - Service Role Key

2. **SMTP/Resend** per email
   - Host SMTP / API Key
   - Email mittente verificata

3. **Twilio** per WhatsApp
   - Account SID
   - Auth Token
   - Numero WhatsApp verificato

## Gestione Errori

Aggiungi un nodo **Error Trigger** per catturare errori e loggarli:

```javascript
// Error Handler Node
const error = $input.first().json;

// Log to Supabase or external service
return {
  error_type: error.name,
  error_message: error.message,
  appointment_id: error.context?.appointment_id,
  timestamp: new Date().toISOString()
};
```

## Test del Workflow

1. Crea un appuntamento di test per domani
2. Esegui manualmente il workflow (click "Execute Workflow")
3. Verifica:
   - Email ricevuta
   - Messaggio WhatsApp ricevuto (usa sandbox Twilio per test)

## Monitoraggio

- Controlla i log di esecuzione in N8N
- Imposta alerting per errori di invio
- Monitora i costi Twilio nel dashboard

## Note Importanti

- **Rate Limits**: Twilio ha limiti di invio. Per volumi alti, considera batch processing
- **Template Approval**: I template WhatsApp richiedono approvazione (24-48h)
- **GDPR**: Assicurati di avere il consenso del cliente per l'invio di reminder
- **Timezone**: La query SQL usa il timezone del database. Verifica sia impostato correttamente

