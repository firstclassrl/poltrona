# Workflow N8N: Notifica Nuova Prenotazione

Questo workflow invia una notifica email al barbiere e crea una notifica in-app quando viene creato un nuovo appuntamento.

## Trigger

**Supabase Webhook** su INSERT nella tabella `appointments`

### Configurazione Webhook Supabase

1. Vai su Supabase Dashboard > Database > Webhooks
2. Crea nuovo webhook:
   - Nome: `new_appointment_notification`
   - Tabella: `appointments`
   - Eventi: `INSERT`
   - URL: `https://tuo-n8n.app.n8n.cloud/webhook/new-appointment`
   - HTTP Headers: `Authorization: Bearer TUO_WEBHOOK_SECRET`

## Struttura Workflow N8N

```
[Webhook Trigger] 
      ↓
[Supabase: Fetch Full Data]
      ↓
[Set Variables]
      ↓
  ┌───┴───┐
  ↓       ↓
[Email]  [Insert Notification]
```

## Nodi del Workflow

### 1. Webhook Trigger

```json
{
  "node": "Webhook",
  "parameters": {
    "httpMethod": "POST",
    "path": "new-appointment",
    "authentication": "headerAuth",
    "headerAuth": {
      "name": "Authorization",
      "value": "Bearer {{$credentials.webhookSecret}}"
    }
  }
}
```

### 2. Supabase - Fetch Full Data

Recupera i dati completi di cliente, barbiere, servizio e negozio.

```sql
-- Query da eseguire via Supabase node
SELECT 
  a.*,
  c.first_name as client_first_name,
  c.last_name as client_last_name,
  c.phone_e164 as client_phone,
  c.email as client_email,
  s.full_name as staff_name,
  s.email as staff_email,
  sv.name as service_name,
  sv.duration_min,
  sv.price_cents,
  sh.name as shop_name,
  sh.notification_email as shop_notification_email
FROM appointments a
LEFT JOIN clients c ON a.client_id = c.id
LEFT JOIN staff s ON a.staff_id = s.id
LEFT JOIN services sv ON a.service_id = sv.id
LEFT JOIN shops sh ON a.shop_id = sh.id
WHERE a.id = '{{$json.record.id}}'
```

### 3. Set Variables

Prepara le variabili per email e notifica:

```javascript
// Code node
const data = $input.first().json;

const appointmentDate = new Date(data.start_at);
const dateFormatted = appointmentDate.toLocaleDateString('it-IT', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric'
});
const timeFormatted = appointmentDate.toLocaleTimeString('it-IT', {
  hour: '2-digit',
  minute: '2-digit'
});

const clientName = `${data.client_first_name} ${data.client_last_name || ''}`.trim();
const price = data.price_cents ? (data.price_cents / 100).toFixed(2) + ' €' : 'N/D';

return {
  appointment_id: data.id,
  client_name: clientName,
  client_phone: data.client_phone,
  client_email: data.client_email,
  staff_name: data.staff_name,
  staff_email: data.staff_email,
  staff_id: data.staff_id,
  service_name: data.service_name,
  duration: data.duration_min,
  price: price,
  date: dateFormatted,
  time: timeFormatted,
  shop_name: data.shop_name,
  shop_notification_email: data.shop_notification_email,
  shop_id: data.shop_id
};
```

### 4. Send Email (SMTP/Resend)

Template email per il barbiere:

**Oggetto:** `🗓️ Nuova prenotazione: {{$json.client_name}} - {{$json.date}}`

**Corpo HTML:**

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; background: #1a1a2e; color: #eee; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #f59e0b, #d97706); padding: 20px; border-radius: 10px 10px 0 0; }
    .header h1 { margin: 0; color: #1a1a2e; }
    .content { background: #2d2d44; padding: 20px; border-radius: 0 0 10px 10px; }
    .detail { margin: 10px 0; padding: 10px; background: #3d3d5c; border-radius: 5px; }
    .label { color: #f59e0b; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🗓️ Nuova Prenotazione</h1>
    </div>
    <div class="content">
      <p>Ciao {{$json.staff_name}},</p>
      <p>Hai ricevuto una nuova prenotazione!</p>
      
      <div class="detail">
        <span class="label">Cliente:</span> {{$json.client_name}}
      </div>
      <div class="detail">
        <span class="label">Telefono:</span> {{$json.client_phone}}
      </div>
      <div class="detail">
        <span class="label">Servizio:</span> {{$json.service_name}}
      </div>
      <div class="detail">
        <span class="label">Data:</span> {{$json.date}}
      </div>
      <div class="detail">
        <span class="label">Ora:</span> {{$json.time}}
      </div>
      <div class="detail">
        <span class="label">Durata:</span> {{$json.duration}} minuti
      </div>
      <div class="detail">
        <span class="label">Prezzo:</span> {{$json.price}}
      </div>
      
      <p style="margin-top: 20px; color: #888;">
        — {{$json.shop_name}}
      </p>
    </div>
  </div>
</body>
</html>
```

### 5. Supabase - Insert Notification

Crea la notifica in-app per il barbiere:

```json
{
  "table": "notifications",
  "operation": "Insert",
  "data": {
    "shop_id": "{{$json.shop_id}}",
    "user_id": "{{$json.staff_id}}",
    "user_type": "staff",
    "type": "new_appointment",
    "title": "Nuova prenotazione",
    "message": "{{$json.client_name}} ha prenotato {{$json.service_name}} per {{$json.date}} alle {{$json.time}}",
    "data": {
      "appointment_id": "{{$json.appointment_id}}",
      "client_name": "{{$json.client_name}}",
      "client_phone": "{{$json.client_phone}}",
      "service_name": "{{$json.service_name}}",
      "appointment_date": "{{$json.date}}",
      "appointment_time": "{{$json.time}}"
    }
  }
}
```

## Credenziali Necessarie

1. **Supabase**
   - URL: `https://xxx.supabase.co`
   - Service Role Key (per bypassare RLS)

2. **SMTP/Resend**
   - Host SMTP o API Key Resend
   - Email mittente verificata

## Test del Workflow

1. Attiva il workflow in N8N
2. Crea un appuntamento di test dall'app
3. Verifica:
   - Email ricevuta dal barbiere
   - Notifica visibile nell'app (campanella)

## Note

- Usa la **Service Role Key** di Supabase per inserire notifiche (bypassa RLS)
- Il webhook Supabase invia i dati del nuovo record in `body.record`
- Considera l'aggiunta di rate limiting per prevenire spam

