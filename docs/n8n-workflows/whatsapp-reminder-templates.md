# Template Messaggi WhatsApp - Reminder Appuntamenti

## ⚠️ REGOLA FONDAMENTALE WHATSAPP

**Se il cliente non ti ha scritto nelle ultime 24 ore, WhatsApp richiede TEMPLATE approvati. Devi usare `type=template` (NON `type=text`). Punto.**

Per i reminder automatici, il cliente NON ha scritto nelle ultime 24h, quindi **DEVI SEMPRE usare template approvati**.

## Panoramica

Questi template sono utilizzati dal workflow n8n per inviare reminder WhatsApp ai clienti per i loro appuntamenti del giorno successivo. **Tutti i messaggi devono usare template approvati da Meta**.

## Template Principale

### Template Base (Testo Semplice)

```
Ciao {{client_name}}! 👋

Ti ricordiamo che hai un appuntamento domani:

📅 Data: {{appointment_date}}
🕐 Ora: {{appointment_time}}
💇 Servizio: {{service_name}}
👨‍💼 Barbiere: {{barber_name}}
🏪 Negozio: {{shop_name}}

Ti aspettiamo! 🎉

Per modifiche o cancellazioni, rispondi a questo messaggio.
```

### Variabili Disponibili

| Variabile | Descrizione | Esempio |
|-----------|-------------|---------|
| `{{client_name}}` | Nome del cliente (first_name) | "Mario" |
| `{{appointment_date}}` | Data appuntamento formattata | "lunedì, 15 gennaio 2024" |
| `{{appointment_time}}` | Ora appuntamento (HH:mm) | "14:30" |
| `{{service_name}}` | Nome del servizio | "Taglio + Barba" |
| `{{barber_name}}` | Nome completo del barbiere | "Giuseppe Rossi" |
| `{{shop_name}}` | Nome del negozio | "Barber Shop Roma" |
| `{{shop_address}}` | Indirizzo del negozio (opzionale) | "Via Roma 123, Roma" |

## Template Alternativi

### Template Breve

```
Ciao {{client_name}}! 👋

Ti ricordiamo l'appuntamento di domani alle {{appointment_time}} per {{service_name}} con {{barber_name}}.

Ti aspettiamo! 🎉
```

### Template Dettagliato (con Indirizzo)

```
Ciao {{client_name}}! 👋

Ti ricordiamo che hai un appuntamento domani:

📅 Data: {{appointment_date}}
🕐 Ora: {{appointment_time}}
💇 Servizio: {{service_name}}
👨‍💼 Barbiere: {{barber_name}}
🏪 Negozio: {{shop_name}}
📍 Indirizzo: {{shop_address}}

Ti aspettiamo! 🎉

Per modifiche o cancellazioni, rispondi a questo messaggio.
```

### Template Professionale

```
Gentile {{client_name}},

Le ricordiamo che ha un appuntamento domani:

📅 Data: {{appointment_date}}
🕐 Ora: {{appointment_time}}
💇 Servizio: {{service_name}}
👨‍💼 Barbiere: {{barber_name}}
🏪 Negozio: {{shop_name}}

La aspettiamo!

Per modifiche o cancellazioni, può rispondere a questo messaggio.

Cordiali saluti,
Il team di {{shop_name}}
```

## Implementazione in n8n

### Codice JavaScript per Formattazione

```javascript
const appointment = $input.item.json;
const client = appointment.clients || {};
const service = appointment.services || {};
const staff = appointment.staff || {};
const shop = appointment.shops || {};

// Formatta data in italiano
const startDate = new Date(appointment.start_at);
const dateStr = startDate.toLocaleDateString('it-IT', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric'
});

// Formatta ora in italiano
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
  phone_number: client.phone_e164
};
```

## Template per WhatsApp Cloud API

### ⚠️ IMPORTANTE: Usare SEMPRE Template

**Per reminder automatici, DEVI SEMPRE usare `type=template`** perché il cliente non ha scritto nelle ultime 24h.

### Formato JSON per API con Template

```json
{
  "messaging_product": "whatsapp",
  "to": "+393491234567",
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
            "text": "Mario"
          },
          {
            "type": "text",
            "text": "15/01/2024"
          },
          {
            "type": "text",
            "text": "14:30"
          },
          {
            "type": "text",
            "text": "Taglio + Barba"
          },
          {
            "type": "text",
            "text": "Giuseppe Rossi"
          },
          {
            "type": "text",
            "text": "Barber Shop Roma"
          }
        ]
      }
    ]
  }
}
```

### Template da Creare in Meta Business Manager

**Nome Template**: `appointment_reminder`  
**Linguaggio**: `it` (Italiano)  
**Categoria**: `UTILITY` o `MARKETING`

**Corpo Template**:
```
Ciao {{1}}! 👋

Ti ricordiamo che hai un appuntamento domani:

📅 Data: {{2}}
🕐 Ora: {{3}}
💇 Servizio: {{4}}
👨‍💼 Barbiere: {{5}}
🏪 Negozio: {{6}}

Ti aspettiamo! 🎉

Per modifiche o cancellazioni, rispondi a questo messaggio.
```

**Parametri**:
1. `{{1}}` - Nome cliente (es. "Mario")
2. `{{2}}` - Data appuntamento (es. "15/01/2024")
3. `{{3}}` - Ora appuntamento (es. "14:30")
4. `{{4}}` - Nome servizio (es. "Taglio + Barba")
5. `{{5}}` - Nome barbiere (es. "Giuseppe Rossi")
6. `{{6}}` - Nome negozio (es. "Barber Shop Roma")

**Nota**: Il template deve essere **approvato da Meta** prima di poter essere usato. Il processo di approvazione può richiedere 24-48 ore.

### Template Approvati (OBBLIGATORIO per Reminder)

⚠️ **Per reminder automatici, devi SEMPRE usare template approvati**. Esempio:

```json
{
  "messaging_product": "whatsapp",
  "to": "+393491234567",
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
            "text": "{{client_name}}"
          },
          {
            "type": "text",
            "text": "{{appointment_date}}"
          },
          {
            "type": "text",
            "text": "{{appointment_time}}"
          },
          {
            "type": "text",
            "text": "{{service_name}}"
          }
        ]
      }
    ]
  }
}
```

**Nota**: Devi prima creare e approvare il template in Meta Business Manager.

## Personalizzazione per Negozio

Puoi personalizzare i template per negozio aggiungendo un campo `whatsapp_reminder_template` nella tabella `shops`:

```sql
ALTER TABLE public.shops 
ADD COLUMN IF NOT EXISTS whatsapp_reminder_template TEXT DEFAULT 'default';
```

Poi nel workflow n8n:

```javascript
const templateType = shop.whatsapp_reminder_template || 'default';

let message;
switch(templateType) {
  case 'breve':
    message = `Ciao ${client.first_name}! 👋\n\nTi ricordiamo l'appuntamento di domani alle ${timeStr} per ${service.name} con ${staff.full_name}.\n\nTi aspettiamo! 🎉`;
    break;
  case 'professionale':
    message = `Gentile ${client.first_name},\n\nLe ricordiamo che ha un appuntamento domani:\n\n📅 Data: ${dateStr}\n🕐 Ora: ${timeStr}\n💇 Servizio: ${service.name}\n👨‍💼 Barbiere: ${staff.full_name}\n🏪 Negozio: ${shop.name}\n\nLa aspettiamo!`;
    break;
  default:
    // Template default
    message = `Ciao ${client.first_name}! 👋\n\nTi ricordiamo che hai un appuntamento domani:\n\n📅 Data: ${dateStr}\n🕐 Ora: ${timeStr}\n💇 Servizio: ${service.name}\n👨‍💼 Barbiere: ${staff.full_name}\n🏪 Negozio: ${shop.name}\n\nTi aspettiamo! 🎉\n\nPer modifiche o cancellazioni, rispondi a questo messaggio.`;
}
```

## Best Practices

1. **Lunghezza Messaggio**: Mantieni i messaggi sotto i 1600 caratteri (limite WhatsApp)
2. **Emoji**: Usa emoji con moderazione, non tutti i client supportano tutte le emoji
3. **Formattazione**: Usa `\n` per andare a capo
4. **Personalizzazione**: Usa sempre il nome del cliente per rendere il messaggio personale
5. **Call to Action**: Includi sempre un modo per il cliente di rispondere o modificare
6. **Test**: Testa sempre i messaggi prima di metterli in produzione

## Esempi di Messaggi Finali

### Esempio 1: Taglio Standard
```
Ciao Mario! 👋

Ti ricordiamo che hai un appuntamento domani:

📅 Data: lunedì, 15 gennaio 2024
🕐 Ora: 14:30
💇 Servizio: Taglio
👨‍💼 Barbiere: Giuseppe Rossi
🏪 Negozio: Barber Shop Roma

Ti aspettiamo! 🎉

Per modifiche o cancellazioni, rispondi a questo messaggio.
```

### Esempio 2: Servizio Completo
```
Ciao Luca! 👋

Ti ricordiamo che hai un appuntamento domani:

📅 Data: martedì, 16 gennaio 2024
🕐 Ora: 10:00
💇 Servizio: Taglio + Barba + Trattamento
👨‍💼 Barbiere: Marco Bianchi
🏪 Negozio: Old School Barbershop

Ti aspettiamo! 🎉

Per modifiche o cancellazioni, rispondi a questo messaggio.
```

## Note Importanti

- **Consenso**: Assicurati che i clienti abbiano dato consenso per ricevere messaggi WhatsApp
- **GDPR**: Rispetta le normative sulla privacy
- **Template Approval**: Per messaggi fuori 24h, usa template approvati da Meta
- **Rate Limiting**: WhatsApp ha limiti di invio, monitora l'utilizzo
- **Test**: Testa sempre i messaggi con numeri di test prima della produzione
