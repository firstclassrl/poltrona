# Sistema Notifiche Email per Registrazione Clienti

## Panoramica

Il sistema invia automaticamente una email di notifica all'amministratore del negozio quando un nuovo cliente si registra. Utilizza **Resend** come servizio email, che è gratuito fino a 3000 email/mese.

## Configurazione

### 1. Database

Eseguire lo script SQL per aggiungere la colonna `notification_email` alla tabella shops:

```sql
-- Eseguire nel SQL Editor di Supabase
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS notification_email TEXT;
```

### 2. Configurazione Resend

1. **Registrati su Resend**: Vai su [resend.com](https://resend.com) e crea un account
2. **Ottieni API Key**: Vai su [API Keys](https://resend.com/api-keys) e crea una nuova chiave
3. **Configura variabile d'ambiente**: Aggiungi al tuo file `.env`:

```env
VITE_RESEND_API_KEY=re_xxxxx
```

### 3. Configurazione Negozio

1. Vai alla pagina **Shop** nell'app
2. Clicca **Modifica**
3. Inserisci l'email di notifica nel campo **"Email Notifiche"**
4. Salva le modifiche

## Funzionamento

### Flusso di Registrazione

1. **Cliente si registra** → Form di registrazione
2. **Utente creato** → Supabase Auth crea l'utente
3. **Profilo creato** → Trigger database crea il profilo
4. **Email inviata** → Sistema invia notifica all'admin del negozio

### Template Email

L'email include:
- Nome del nuovo cliente
- Email del cliente
- Data e ora di registrazione
- Nome del negozio
- Link per visualizzare il profilo (da implementare)

### Gestione Errori

- Se l'email fallisce, la registrazione procede comunque
- Gli errori vengono loggati nella console
- Modalità mock se Resend non è configurato

## Test del Sistema

### 1. Test Registrazione

1. Vai su http://localhost:5173
2. Clicca **"Registrati"**
3. Compila il form con dati di test
4. Controlla la console per i log
5. Verifica che l'email sia stata inviata

### 2. Test Configurazione

```javascript
// Nella console del browser
import { emailNotificationService } from './src/services/emailNotificationService';

// Test configurazione
await emailNotificationService.testConfiguration();

// Test invio email
await emailNotificationService.sendNewClientNotification({
  clientName: 'Test Cliente',
  clientEmail: 'test@example.com',
  registrationDate: new Date().toLocaleDateString('it-IT'),
  shopName: 'Test Shop'
}, 'admin@test.com');
```

## Personalizzazione

### Modificare Template Email

Il template HTML è in `src/services/emailNotificationService.ts` nel metodo `generateNewClientNotificationHTML()`.

### Aggiungere Campi

Per aggiungere più informazioni al cliente:

1. Modifica `NewClientNotificationData` interface
2. Aggiorna il template HTML
3. Passa i dati nella chiamata `sendNewClientNotification`

### Usare Dominio Personalizzato

1. Verifica il tuo dominio su Resend
2. Modifica il campo `from` nell'API call
3. Aggiorna le policy DNS se necessario

## Troubleshooting

### Email non arriva

1. **Controlla API Key**: Verifica che `VITE_RESEND_API_KEY` sia configurata
2. **Controlla spam**: L'email potrebbe essere finita nello spam
3. **Controlla logs**: Verifica la console per errori
4. **Test configurazione**: Usa `testConfiguration()` per verificare

### Errore "Supabase non configurato"

1. Verifica le variabili d'ambiente Supabase
2. Controlla che il database sia accessibile
3. Verifica le policy RLS

### Errore "Email notifica non configurata"

1. Vai alla pagina Shop
2. Inserisci un'email valida nel campo "Email Notifiche"
3. Salva le modifiche

## Limitazioni

- **Resend gratuito**: 3000 email/mese
- **Dominio**: Usa `noreply@resend.dev` di default
- **Telefono**: Non disponibile nel form di registrazione attuale
- **Multi-negozio**: Ogni negozio ha la propria email di notifica

## Prossimi Miglioramenti

- [ ] Aggiungere campo telefono al form di registrazione
- [ ] Implementare link diretto al profilo cliente nell'email
- [ ] Aggiungere template email personalizzabili
- [ ] Implementare notifiche per altri eventi (appuntamenti, etc.)
- [ ] Aggiungere dashboard per gestire le notifiche
