# Template Email Supabase

Questi template possono essere copiati e incollati direttamente nelle impostazioni email di Supabase Dashboard.

## Come configurare i template in Supabase

1. Accedi al **Supabase Dashboard**
2. Vai a **Authentication** → **Email Templates**
3. Seleziona il template che vuoi modificare:
   - **Confirm signup** (Conferma iscrizione)
   - **Reset password** (Reset password)
4. Incolla il template HTML corrispondente
5. Clicca su **Save**

---

## 1. Template Conferma Iscrizione (Confirm Signup)

### Subject (Oggetto):
```
Conferma la tua email - {{ .SiteName }}
```

### HTML Template:
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Conferma la tua email</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      background-color: #f9fafb;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      box-shadow: 0 10px 25px rgba(15, 23, 42, 0.1);
      overflow: hidden;
      border: 1px solid #e5e7eb;
    }
    .hero {
      background: linear-gradient(135deg, #3b82f6, #2563eb);
      color: #ffffff;
      text-align: center;
      padding: 40px 24px;
    }
    .hero-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }
    .hero h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
    }
    .content {
      padding: 40px 32px;
    }
    .welcome-text {
      font-size: 18px;
      color: #374151;
      margin-bottom: 24px;
      line-height: 1.8;
    }
    .confirmation-box {
      background: linear-gradient(135deg, #eff6ff, #dbeafe);
      border: 2px solid #3b82f6;
      border-radius: 12px;
      padding: 24px;
      margin: 32px 0;
      text-align: center;
    }
    .confirmation-box p {
      margin: 0 0 20px 0;
      font-size: 16px;
      color: #1e40af;
      font-weight: 600;
    }
    .cta-button {
      display: inline-block;
      padding: 16px 32px;
      background: linear-gradient(135deg, #3b82f6, #2563eb);
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);
    }
    .info-box {
      background-color: #f3f4f6;
      border-left: 4px solid #6b7280;
      border-radius: 8px;
      padding: 16px 20px;
      margin: 24px 0;
      font-size: 14px;
      color: #4b5563;
    }
    .info-box strong {
      color: #1f2937;
    }
    .footer {
      text-align: center;
      font-size: 12px;
      color: #9ca3af;
      padding: 24px 32px;
      background-color: #f9fafb;
      border-top: 1px solid #e5e7eb;
    }
    .footer-link {
      color: #3b82f6;
      text-decoration: none;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="hero">
      <div class="hero-icon">✉️</div>
      <h1>Conferma la tua email</h1>
    </div>
    <div class="content">
      <p class="welcome-text">
        Ciao,
      </p>
      <p class="welcome-text">
        Grazie per esserti registrato su <strong>{{ .SiteName }}</strong>! Per completare la registrazione e attivare il tuo account, ti chiediamo di confermare il tuo indirizzo email.
      </p>
      
      <div class="confirmation-box">
        <p>Conferma il tuo indirizzo email cliccando sul pulsante qui sotto:</p>
        <a href="{{ .ConfirmationURL }}" class="cta-button" target="_blank" rel="noopener noreferrer">
          Conferma Email
        </a>
      </div>

      <div class="info-box">
        <strong>💡 Non riesci a cliccare il pulsante?</strong><br />
        Copia e incolla questo link nel tuo browser:<br />
        <a href="{{ .ConfirmationURL }}" class="footer-link">{{ .ConfirmationURL }}</a>
      </div>

      <p style="font-size: 14px; color: #6b7280; margin-top: 24px;">
        Se non hai richiesto questa registrazione, puoi ignorare questa email. Il tuo account non verrà creato finché non confermi l'indirizzo email.
      </p>

      <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
        Il link di conferma scade dopo 24 ore per motivi di sicurezza.
      </p>

      <p style="margin-top: 32px; color: #374151;">
        A presto,<br />
        <strong>Il team di {{ .SiteName }}</strong>
      </p>
    </div>
    <div class="footer">
      <p>Questa email è stata inviata a {{ .Email }}</p>
      <p>Se non hai richiesto questa registrazione, ignora questa email.</p>
      <p style="margin-top: 12px;">
        © {{ .SiteName }} - Tutti i diritti riservati
      </p>
    </div>
  </div>
</body>
</html>
```

### Text Template (versione testo semplice):
```
CONFERMA LA TUA EMAIL - {{ .SiteName }}

Ciao,

Grazie per esserti registrato su {{ .SiteName }}!

Per completare la registrazione e attivare il tuo account, ti chiediamo di confermare il tuo indirizzo email cliccando sul link qui sotto:

{{ .ConfirmationURL }}

Se non riesci a cliccare il link, copia e incolla l'URL sopra nel tuo browser.

IMPORTANTE:
- Il link di conferma scade dopo 24 ore per motivi di sicurezza
- Se non hai richiesto questa registrazione, puoi ignorare questa email
- Il tuo account non verrà creato finché non confermi l'indirizzo email

A presto,
Il team di {{ .SiteName }}

---
Questa email è stata inviata a {{ .Email }}
Se non hai richiesto questa registrazione, ignora questa email.
© {{ .SiteName }} - Tutti i diritti riservati
```

---

## 2. Template Reset Password (Reset Password)

### Subject (Oggetto):
```
Reimposta la tua password - {{ .SiteName }}
```

### HTML Template:
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reimposta la tua password</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      background-color: #f9fafb;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      box-shadow: 0 10px 25px rgba(15, 23, 42, 0.1);
      overflow: hidden;
      border: 1px solid #e5e7eb;
    }
    .hero {
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: #ffffff;
      text-align: center;
      padding: 40px 24px;
    }
    .hero-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }
    .hero h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
    }
    .content {
      padding: 40px 32px;
    }
    .welcome-text {
      font-size: 18px;
      color: #374151;
      margin-bottom: 24px;
      line-height: 1.8;
    }
    .reset-box {
      background: linear-gradient(135deg, #fef3c7, #fde68a);
      border: 2px solid #f59e0b;
      border-radius: 12px;
      padding: 24px;
      margin: 32px 0;
      text-align: center;
    }
    .reset-box p {
      margin: 0 0 20px 0;
      font-size: 16px;
      color: #92400e;
      font-weight: 600;
    }
    .cta-button {
      display: inline-block;
      padding: 16px 32px;
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      box-shadow: 0 4px 6px rgba(245, 158, 11, 0.3);
    }
    .warning-box {
      background-color: #fef2f2;
      border-left: 4px solid #ef4444;
      border-radius: 8px;
      padding: 16px 20px;
      margin: 24px 0;
      font-size: 14px;
      color: #991b1b;
    }
    .warning-box strong {
      color: #dc2626;
    }
    .info-box {
      background-color: #f3f4f6;
      border-left: 4px solid #6b7280;
      border-radius: 8px;
      padding: 16px 20px;
      margin: 24px 0;
      font-size: 14px;
      color: #4b5563;
    }
    .info-box strong {
      color: #1f2937;
    }
    .footer {
      text-align: center;
      font-size: 12px;
      color: #9ca3af;
      padding: 24px 32px;
      background-color: #f9fafb;
      border-top: 1px solid #e5e7eb;
    }
    .footer-link {
      color: #f59e0b;
      text-decoration: none;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="hero">
      <div class="hero-icon">🔐</div>
      <h1>Reimposta la tua password</h1>
    </div>
    <div class="content">
      <p class="welcome-text">
        Ciao,
      </p>
      <p class="welcome-text">
        Abbiamo ricevuto una richiesta per reimpostare la password del tuo account su <strong>{{ .SiteName }}</strong>. Se hai fatto tu questa richiesta, clicca sul pulsante qui sotto per creare una nuova password.
      </p>
      
      <div class="reset-box">
        <p>Reimposta la tua password cliccando sul pulsante qui sotto:</p>
        <a href="{{ .ConfirmationURL }}" class="cta-button" target="_blank" rel="noopener noreferrer">
          Reimposta Password
        </a>
      </div>

      <div class="warning-box">
        <strong>⚠️ Attenzione!</strong><br />
        Se non hai richiesto il reset della password, ignora questa email. La tua password attuale rimarrà invariata.
      </div>

      <div class="info-box">
        <strong>💡 Non riesci a cliccare il pulsante?</strong><br />
        Copia e incolla questo link nel tuo browser:<br />
        <a href="{{ .ConfirmationURL }}" class="footer-link">{{ .ConfirmationURL }}</a>
      </div>

      <p style="font-size: 14px; color: #6b7280; margin-top: 24px;">
        Il link scade dopo 1 ora per motivi di sicurezza.
      </p>

      <p style="font-size: 14px; color: #6b7280; margin-top: 16px;">
        Per motivi di sicurezza, questo link può essere utilizzato una sola volta. Se il link è scaduto o hai già reimpostato la password, puoi richiedere un nuovo link dalla pagina di login.
      </p>

      <p style="margin-top: 32px; color: #374151;">
        A presto,<br />
        <strong>Il team di {{ .SiteName }}</strong>
      </p>
    </div>
    <div class="footer">
      <p>Questa email è stata inviata a {{ .Email }}</p>
      <p>Se non hai richiesto il reset della password, ignora questa email.</p>
      <p style="margin-top: 12px;">
        © {{ .SiteName }} - Tutti i diritti riservati
      </p>
    </div>
  </div>
</body>
</html>
```

### Text Template (versione testo semplice):
```
REIMPOSTA LA TUA PASSWORD - {{ .SiteName }}

Ciao,

Abbiamo ricevuto una richiesta per reimpostare la password del tuo account su {{ .SiteName }}.

Se hai fatto tu questa richiesta, clicca sul link qui sotto per creare una nuova password:

{{ .ConfirmationURL }}

Se non riesci a cliccare il link, copia e incolla l'URL sopra nel tuo browser.

⚠️ ATTENZIONE:
- Se non hai richiesto il reset della password, IGNORA questa email
- La tua password attuale rimarrà invariata se non clicchi sul link
- Questo link può essere utilizzato una sola volta
- Il link scade dopo 1 ora per motivi di sicurezza

Se il link è scaduto o hai già reimpostato la password, puoi richiedere un nuovo link dalla pagina di login.

A presto,
Il team di {{ .SiteName }}

---
Questa email è stata inviata a {{ .Email }}
Se non hai richiesto il reset della password, ignora questa email.
© {{ .SiteName }} - Tutti i diritti riservati
```

---

## Variabili disponibili in Supabase

I template utilizzano le seguenti variabili che Supabase sostituisce automaticamente:

- `{{ .SiteName }}` - Nome del sito/applicazione
- `{{ .SiteURL }}` - URL base del sito
- `{{ .Email }}` - Indirizzo email dell'utente
- `{{ .ConfirmationURL }}` - URL completo per confermare/resettare (include il token)
- `{{ .Token }}` - Token di conferma/reset (solo se necessario)
- `{{ .TokenHash }}` - Hash del token (solo se necessario)
- `{{ .RedirectTo }}` - URL di redirect dopo la conferma

## Note importanti

1. **Test dei template**: Dopo aver salvato i template, testa l'invio di email di prova dal dashboard Supabase
2. **Compatibilità**: I template sono compatibili con la maggior parte dei client email
3. **Responsive**: I template sono ottimizzati per desktop e mobile
4. **Sicurezza**: I link includono token sicuri generati da Supabase
5. **Personalizzazione**: Puoi modificare colori, testi e stili secondo le tue preferenze

## Troubleshooting

- Se i template non vengono applicati, verifica di aver salvato correttamente nel dashboard
- Se le variabili non vengono sostituite, controlla la sintassi `{{ .Variabile }}`
- Se l'email non arriva, verifica le impostazioni SMTP in Supabase
