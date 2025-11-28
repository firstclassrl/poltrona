# 🚀 Setup Completo N8N per Email - Poltrona

## ✅ **Perché N8N?**

- ✅ **Nessun problema SMTP** - Gestisci tutto via webhook
- ✅ **Interfaccia visuale** - Facile da configurare
- ✅ **Piano gratuito** - 100 esecuzioni/giorno (sufficiente!)
- ✅ **Flessibile** - Aggiungi WhatsApp, SMS, ecc. facilmente
- ✅ **Monitoraggio** - Vedi tutti gli invii in tempo reale

---

## 📋 **PASSO 1: Setup N8N** (5 minuti)

### Opzione A: N8N Cloud (Consigliato) ⭐

1. **Vai su** [n8n.cloud](https://n8n.cloud)
2. **Crea account** gratuito
3. **Piano gratuito include**:
   - 5 workflow attivi
   - 100 esecuzioni/giorno
   - **Sufficiente per un barbershop!**

### Opzione B: Self-Hosted

```bash
docker run -d --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n
```

---

## 🔧 **PASSO 2: Configura Credenziali N8N**

### 2.1 Supabase Credentials

1. **N8N Dashboard** → Settings → **Credentials**
2. **Add Credential** → **Supabase**
3. **Compila**:
   ```
   Name: Supabase Poltrona
   Host: https://tlwxsluoqzdluzneugbe.supabase.co
   Service Role Key: [La tua Service Role Key da Supabase]
   ```
4. **Dove trovare Service Role Key**:
   - Supabase Dashboard → Project Settings → API
   - Copia "service_role" key (NON anon key!)

### 2.2 Email Credentials (SMTP o Resend)

#### Opzione A: Resend (Più Semplice) ⭐

1. **Registrati** su [resend.com](https://resend.com) (gratis, 3000 email/mese)
2. **Verifica email** sender (o dominio)
3. **Crea API Key**
4. **N8N** → Credentials → **HTTP Request**
   ```
   Name: Resend Email
   Authentication: Header Auth
   Header Name: Authorization
   Header Value: Bearer re_xxxxxxxxxxxx
   ```

#### Opzione B: SMTP (Gmail, Outlook, ecc.)

1. **N8N** → Credentials → **SMTP**
2. **Compila**:
   ```
   Host: smtp.gmail.com (o il tuo provider)
   Port: 587
   User: tuaemail@gmail.com
   Password: [App Password per Gmail]
   ```

---

## 📧 **PASSO 3: Crea Workflow Email**

### Workflow 1: Nuova Prenotazione

#### 3.1 Crea Webhook in N8N

1. **N8N** → **Add Workflow**
2. **Aggiungi nodo** → **Webhook**
3. **Configura**:
   ```
   HTTP Method: POST
   Path: new-appointment
   Response Mode: Respond When Last Node Finishes
   ```
4. **Copia l'URL** del webhook (es. `https://tuo-n8n.app.n8n.cloud/webhook/new-appointment`)

#### 3.2 Configura Webhook in Supabase

1. **Supabase Dashboard** → **Database** → **Webhooks**
2. **Enable Webhooks** (se non attivo)
3. **Create Webhook**:
   ```
   Name: new_appointment_email
   Table: appointments
   Events: INSERT
   Type: HTTP Request
   URL: [L'URL del webhook N8N che hai copiato]
   HTTP Headers: 
     Authorization: Bearer [UN_SECRET_A_CASO]
   ```

#### 3.3 Completa il Workflow N8N

**Struttura**:
```
[Webhook] → [Code: Parse Data] → [Supabase: Get Full Data] → [Code: Format Email] → [Send Email] → [Supabase: Create Notification]
```

**Nodo 1: Webhook** (già configurato)

**Nodo 2: Code - Parse Data**
```javascript
// Estrai i dati dal webhook
const webhookData = $input.first().json;
const appointmentId = webhookData.record?.id || webhookData.id;

return {
  appointment_id: appointmentId,
  raw_data: webhookData
};
```

**Nodo 3: Supabase - Get Full Data**
```
Operation: Execute Query
Query:
SELECT 
  a.*,
  c.first_name || ' ' || COALESCE(c.last_name, '') as client_name,
  c.email as client_email,
  c.phone_e164 as client_phone,
  s.full_name as staff_name,
  s.user_id as staff_user_id,
  s.id as staff_id,
  sv.name as service_name,
  sh.name as shop_name,
  sh.notification_email as shop_email
FROM appointments a
LEFT JOIN clients c ON a.client_id = c.id
LEFT JOIN staff s ON a.staff_id = s.id
LEFT JOIN services sv ON a.service_id = sv.id
LEFT JOIN shops sh ON a.shop_id = sh.id
WHERE a.id = '{{$json.appointment_id}}'
```

**Nodo 4: Code - Format Email**
```javascript
const data = $input.first().json;
const startDate = new Date(data.start_at);

const dateFormatted = startDate.toLocaleDateString('it-IT', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});

const timeFormatted = startDate.toLocaleTimeString('it-IT', {
  hour: '2-digit',
  minute: '2-digit'
});

return {
  // Email al barbiere
  barber_email: data.shop_email || data.staff_email,
  barber_subject: `🔔 Nuova Prenotazione - ${data.client_name}`,
  barber_html: `
    <h2>Nuova Prenotazione!</h2>
    <p><strong>Cliente:</strong> ${data.client_name}</p>
    <p><strong>Servizio:</strong> ${data.service_name}</p>
    <p><strong>Data:</strong> ${dateFormatted}</p>
    <p><strong>Orario:</strong> ${timeFormatted}</p>
    <p><strong>Telefono:</strong> ${data.client_phone || 'N/A'}</p>
  `,
  
  // Email al cliente
  client_email: data.client_email,
  client_subject: `✅ Conferma Prenotazione - ${data.shop_name}`,
  client_html: `
    <h2>Prenotazione Confermata!</h2>
    <p>Ciao ${data.client_name.split(' ')[0]},</p>
    <p>La tua prenotazione è stata confermata:</p>
    <p><strong>Servizio:</strong> ${data.service_name}</p>
    <p><strong>Data:</strong> ${dateFormatted}</p>
    <p><strong>Orario:</strong> ${timeFormatted}</p>
    <p><strong>Barbiere:</strong> ${data.staff_name}</p>
  `,
  
  // Dati per notifica
  notification_data: {
    staff_user_id: data.staff_user_id || data.staff_id,
    staff_id: data.staff_id,
    shop_id: data.shop_id,
    client_name: data.client_name,
    service_name: data.service_name,
    date: dateFormatted,
    time: timeFormatted
  }
};
```

**Nodo 5: Send Email (Resend o SMTP)**
- **To**: `{{$json.barber_email}}`
- **Subject**: `{{$json.barber_subject}}`
- **HTML**: `{{$json.barber_html}}`

**Nodo 6: Send Email (Cliente)** - Duplica il nodo 5
- **To**: `{{$json.client_email}}`
- **Subject**: `{{$json.client_subject}}`
- **HTML**: `{{$json.client_html}}`

**Nodo 7: Supabase - Create Notification**
```
Operation: Insert
Table: notifications
Data:
{
  "shop_id": "{{$json.notification_data.shop_id}}",
  "user_id": "{{$json.notification_data.staff_user_id}}",
  "user_type": "staff",
  "type": "new_appointment",
  "title": "🔔 Nuovo Appuntamento!",
  "message": "{{$json.notification_data.client_name}} ha prenotato {{$json.notification_data.service_name}} per {{$json.notification_data.date}} alle {{$json.notification_data.time}}",
  "data": {
    "appointment_id": "{{$json.appointment_id}}",
    "client_name": "{{$json.notification_data.client_name}}",
    "service_name": "{{$json.notification_data.service_name}}",
    "appointment_date": "{{$json.notification_data.date}}",
    "appointment_time": "{{$json.notification_data.time}}"
  }
}
```

#### 3.4 Attiva il Workflow

1. **Toggle** in alto a destra → **ON** (verde)
2. **Salva** il workflow

---

### Workflow 2: Annullamento Prenotazione

**Stessa struttura**, ma:
- **Webhook path**: `cancel-appointment`
- **Supabase Webhook**: Event `UPDATE` con filtro `status = 'cancelled'`
- **Email template**: Messaggio di annullamento

---

### Workflow 3: Nuovo Cliente Registrato

**Stessa struttura**, ma:
- **Webhook path**: `new-client`
- **Supabase Webhook**: Tabella `profiles`, Event `INSERT` con filtro `role = 'client'`
- **Email template**: Benvenuto cliente + notifica barbiere

---

## 🧪 **PASSO 4: Test**

### Test 1: Nuova Prenotazione

1. **Crea** un appuntamento dall'app
2. **Controlla** N8N → Executions (dovresti vedere l'esecuzione)
3. **Verifica**:
   - ✅ Email ricevuta dal barbiere
   - ✅ Email ricevuta dal cliente
   - ✅ Notifica in-app creata

### Test 2: Annullamento

1. **Annulla** un appuntamento dall'app
2. **Verifica** email di conferma annullamento

---

## 🔍 **Monitoraggio**

### N8N Dashboard
- **Executions**: Vedi tutte le esecuzioni
- **Logs**: Dettagli di ogni esecuzione
- **Errori**: Vengono evidenziati in rosso

### Supabase Logs
- **Auth Logs**: Per email di invito
- **Database Logs**: Per webhook

---

## 🆘 **Troubleshooting**

### Webhook non si attiva
- ✅ Verifica che il workflow sia **attivo** (toggle verde)
- ✅ Controlla l'URL del webhook in Supabase
- ✅ Verifica i log in N8N Executions

### Email non arrivano
- ✅ Controlla le credenziali email in N8N
- ✅ Verifica la cartella spam
- ✅ Controlla i log N8N per errori

### Notifiche non create
- ✅ Verifica di usare **Service Role Key** (non anon key)
- ✅ Controlla che il `user_id` sia corretto

---

## 💰 **Costi**

| Servizio | Piano Gratuito | Costo Mensile |
|----------|---------------|---------------|
| **N8N Cloud** | 100 exec/giorno | €20 (10k exec) |
| **Resend** | 3000 email/mese | €20 (50k email) |

**Per un barbershop medio**: **GRATIS!** 🎉

---

## ✅ **Vantaggi N8N**

- ✅ Nessun problema SMTP
- ✅ Interfaccia visuale facile
- ✅ Aggiungi WhatsApp/SMS facilmente
- ✅ Monitoraggio completo
- ✅ Piano gratuito sufficiente

---

**Ora configura N8N e dimentica i problemi SMTP!** 🚀

