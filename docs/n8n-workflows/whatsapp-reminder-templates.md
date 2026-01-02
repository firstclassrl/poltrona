# Template Messaggi WhatsApp - Reminder Appuntamenti

## Panoramica

Questi template sono utilizzati dal workflow n8n per inviare reminder WhatsApp ai clienti per i loro appuntamenti del giorno successivo.

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

### Formato JSON per API

```json
{
  "messaging_product": "whatsapp",
  "to": "+393491234567",
  "type": "text",
  "text": {
    "body": "Ciao Mario! 👋\n\nTi ricordiamo che hai un appuntamento domani:\n\n📅 Data: lunedì, 15 gennaio 2024\n🕐 Ora: 14:30\n💇 Servizio: Taglio + Barba\n👨‍💼 Barbiere: Giuseppe Rossi\n🏪 Negozio: Barber Shop Roma\n\nTi aspettiamo! 🎉\n\nPer modifiche o cancellazioni, rispondi a questo messaggio."
  }
}
```

### Template Approvati (per Messaggi Fuori 24h)

Se vuoi inviare messaggi fuori dalla finestra 24h, devi usare template approvati da Meta. Esempio:

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
