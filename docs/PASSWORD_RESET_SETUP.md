# Configurazione Recupero Password

Questa guida spiega come configurare Supabase per il recupero password nell'applicazione Poltrona.

## Panoramica

Il sistema di recupero password utilizza Supabase Auth per inviare email di recupero agli utenti. Quando un utente richiede il reset della password, riceve un'email con un link che lo porta a una pagina dell'app dove può inserire la nuova password.

## Configurazione Supabase

### 1. Configurare Redirect URL

1. Accedi al **Supabase Dashboard**
2. Vai a **Authentication** → **URL Configuration**
3. Nella sezione **Redirect URLs**, aggiungi l'URL della tua applicazione con il formato:
   ```
   https://[TUO-DOMINIO]/?token={token}&type=recovery
   ```
   
   Esempi:
   - Produzione: `https://poltrona.abruzzo.ai/?token={token}&type=recovery`
   - Sviluppo locale: `http://localhost:5173/?token={token}&type=recovery`

4. Clicca su **Save**

**Nota**: Il placeholder `{token}` verrà sostituito automaticamente da Supabase con il token di recovery quando invia l'email.

### 2. Configurare SMTP (Email)

Per inviare le email di recupero password, devi configurare SMTP in Supabase:

1. Vai a **Authentication** → **SMTP Settings**
2. Configura le impostazioni SMTP in base al tuo provider:

#### Configurazione per Aruba (info@abruzzo.ai)

Se usi **Aruba** come provider email, configura così:

- **SMTP Host**: `smtps.aruba.it` (per SSL) oppure `smtp.aruba.it` (per TLS)
- **SMTP Port**: `465` (per SSL) oppure `587` (per TLS/STARTTLS)
- **SMTP User**: `info@abruzzo.ai` (l'indirizzo email completo)
- **SMTP Password**: La password della casella email `info@abruzzo.ai`
- **Sender Email**: `info@abruzzo.ai`
- **Sender Name**: `Poltrona` (o il nome che preferisci)
- **Enable Secure Email**: ✅ Abilitato (per SSL/TLS)

**Nota importante per Aruba**:
- Usa la porta **465** con **SSL** (smtps.aruba.it) per maggiore compatibilità
- Assicurati che la password sia quella corretta della casella email
- Se hai problemi, prova anche con porta **587** e **TLS/STARTTLS**

3. Clicca su **Save** e testa l'invio di una email di prova

#### Altri Provider

- **Gmail**: Usa `smtp.gmail.com`, porta `587`, e genera una "App Password" nelle impostazioni Google Account
- **Resend/SendGrid**: Usa le credenziali SMTP fornite dal servizio
- **Altri provider**: Consulta la documentazione del tuo provider per le impostazioni SMTP

### 3. Personalizzare Email Template (Opzionale)

Puoi personalizzare il template dell'email di recupero password:

1. Vai a **Authentication** → **Email Templates**
2. Seleziona **Reset Password** o **Change Email Address** (a seconda della versione di Supabase)
3. Personalizza il template HTML e il testo
4. Usa `{{ .ConfirmationURL }}` per inserire il link di recupero nel template

**Template di esempio**:
```html
<h2>Recupera la tua password</h2>
<p>Clicca sul link seguente per reimpostare la tua password:</p>
<p><a href="{{ .ConfirmationURL }}">Reimposta password</a></p>
<p>Se non hai richiesto questo reset, ignora questa email.</p>
```

## Flusso di Recupero Password

1. **Utente richiede reset**: L'utente clicca su "Password dimenticata?" nella pagina di login e inserisce la sua email
2. **Email inviata**: Supabase invia un'email con un link contenente un token di recovery
3. **Utente clicca link**: L'utente viene reindirizzato all'app con `?token=XXX&type=recovery` nell'URL
4. **Inserimento nuova password**: L'app mostra il form per inserire la nuova password
5. **Conferma e login**: Dopo aver confermato, la password viene aggiornata e l'utente viene loggato automaticamente

## Verifica Configurazione

Per verificare che tutto funzioni:

1. **Test locale**:
   - Avvia l'app in sviluppo
   - Vai alla pagina di login
   - Clicca su "Password dimenticata?"
   - Inserisci un'email valida
   - Controlla la casella email (e spam) per il link di recupero
   - Clicca sul link e verifica che ti porti alla pagina di reset password

2. **Test produzione**:
   - Assicurati che il redirect URL sia configurato correttamente
   - Verifica che SMTP sia configurato e funzionante
   - Testa il flusso completo end-to-end

## Troubleshooting

### Email non ricevute

- **Controlla spam**: Le email potrebbero finire nella cartella spam
- **Verifica SMTP**: Controlla che le credenziali SMTP siano corrette
- **Log Supabase**: Controlla i log in Supabase Dashboard → Logs → Auth Logs

### Problemi specifici Aruba

Se usi Aruba e hai problemi con l'invio email:

1. **Verifica credenziali**:
   - Assicurati che l'email `info@abruzzo.ai` esista e sia attiva
   - Verifica che la password sia corretta (prova ad accedere via webmail Aruba)

2. **Prova porte alternative**:
   - Se porta `465` (SSL) non funziona, prova `587` (TLS)
   - Se `smtps.aruba.it` non funziona, prova `smtp.aruba.it`

3. **Verifica firewall/restrizioni**:
   - Aruba potrebbe richiedere che l'IP di Supabase sia autorizzato
   - Controlla il pannello Aruba per eventuali restrizioni SMTP

4. **Test connessione SMTP**:
   - Puoi testare le credenziali SMTP usando un client email esterno (es. Thunderbird, Outlook)
   - Se funziona lì, dovrebbe funzionare anche in Supabase

5. **Contatta supporto Aruba**:
   - Se persistono problemi, contatta il supporto Aruba per verificare che SMTP sia abilitato per il tuo account

### Link non funziona

- **Verifica Redirect URL**: Assicurati che l'URL sia configurato correttamente in Supabase
- **Token scaduto**: I token di recovery scadono dopo un certo periodo (default: 1 ora)
- **URL malformato**: Verifica che l'URL contenga `?token=XXX&type=recovery`

### Errore "Token non valido"

- Il token potrebbe essere scaduto (richiedi un nuovo link)
- Il token potrebbe essere già stato usato (i token sono monouso)
- Verifica che il tipo sia `recovery` nell'URL

## Note Importanti

- **Sicurezza**: Supabase non rivela se un'email esiste o meno nel database per motivi di sicurezza
- **Token expiration**: I token di recovery hanno una scadenza (default: 1 ora). Puoi configurarlo in Supabase Dashboard
- **Rate limiting**: Supabase limita il numero di richieste di reset password per prevenire abusi
- **HTTPS**: In produzione, assicurati di usare HTTPS per la sicurezza dei token

## Riferimenti

- [Documentazione Supabase Auth - Password Reset](https://supabase.com/docs/guides/auth/auth-password-reset)
- [Documentazione Supabase - SMTP Configuration](https://supabase.com/docs/guides/auth/auth-smtp)
- [Documentazione Supabase - Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)
