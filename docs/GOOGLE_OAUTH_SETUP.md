# Configurazione Google OAuth per Poltrona

Questa guida spiega come configurare l'autenticazione Google OAuth per permettere ai clienti di registrarsi e accedere usando il proprio account Google.

## Prerequisiti

- Account Google Cloud Platform
- Progetto Supabase configurato
- Accesso al dashboard Supabase

## Passo 1: Configurare Google Cloud Console

### 1.1 Creare un progetto (se non esiste già)

1. Vai su [Google Cloud Console](https://console.cloud.google.com/)
2. Clicca sul menu a tendina del progetto in alto
3. Clicca su "Nuovo progetto"
4. Inserisci un nome per il progetto (es. "Poltrona OAuth")
5. Clicca su "Crea"

### 1.2 Abilitare Google+ API

1. Nel menu laterale, vai su **API e servizi** > **Libreria**
2. Cerca "Google+ API"
3. Clicca su "Google+ API" e poi su "Abilita"

### 1.3 Creare credenziali OAuth 2.0

1. Vai su **API e servizi** > **Credenziali**
2. Clicca su **+ CREA CREDENZIALI** > **ID client OAuth**
3. Se richiesto, configura la schermata di consenso OAuth:
   - Tipo di app: **Esterno**
   - Nome app: "Poltrona"
   - Email di supporto: la tua email
   - Dominio autorizzato: il dominio del tuo sito (es. `abruzzo.ai`)
   - Clicca su **Salva e continua**
   - Aggiungi il tuo indirizzo email come utente di test
   - Clicca su **Salva e continua** fino alla fine

4. Configura l'ID client OAuth:
   - Tipo di applicazione: **Applicazione Web**
   - Nome: "Poltrona Web Client" (o "Poltrona" se preferisci)
   - **Authorized JavaScript origins**: 
     - ⚠️ **NON è necessario** per Supabase OAuth - puoi lasciare vuoto o ignorare questo campo
     - Se vedi un errore, rimuovi il campo vuoto cliccando sulla "X" accanto
   - **Authorized redirect URIs**: Clicca su "+ Add URI" e aggiungi:
     ```
     https://[YOUR-PROJECT-REF].supabase.co/auth/v1/callback
     ```
     **Come trovare YOUR-PROJECT-REF:**
     1. Vai al [Dashboard Supabase](https://app.supabase.com/)
     2. Seleziona il tuo progetto
     3. Guarda l'URL nella barra degli indirizzi: `https://app.supabase.com/project/xyz123abc456`
     4. Il codice dopo `/project/` (es. `xyz123abc456`) è il tuo project reference
     5. Esempio completo: se il tuo project ref è `xyz123abc456`, inserisci:
        ```
        https://xyz123abc456.supabase.co/auth/v1/callback
        ```

5. Clicca su **Crea**
6. **IMPORTANTE**: Copia il **Client ID** e il **Client Secret** - ti serviranno nel prossimo passo

## Passo 2: Configurare Supabase

### 2.1 Abilitare Google Provider

1. Vai al [Dashboard Supabase](https://app.supabase.com/)
2. Seleziona il tuo progetto
3. Nel menu laterale, vai su **Authentication** > **Providers**
4. Trova **Google** nella lista dei provider
5. Clicca per espandere le opzioni di Google

### 2.2 Inserire le credenziali

1. **Abilita Google**: Attiva il toggle "Enable Google provider"
2. **Client ID (for Google OAuth)**: Incolla il Client ID copiato da Google Cloud Console
3. **Client Secret (for Google OAuth)**: Incolla il Client Secret copiato da Google Cloud Console
4. Clicca su **Save**

### 2.3 Verificare Redirect URL

Supabase dovrebbe già avere configurato automaticamente il redirect URL corretto:
```
https://[YOUR-PROJECT-REF].supabase.co/auth/v1/callback
```

Verifica che questo URL corrisponda a quello che hai inserito in Google Cloud Console.

## Passo 3: Testare l'integrazione

### 3.1 Test locale (sviluppo)

Se stai testando in locale, devi anche aggiungere l'URL locale come redirect autorizzato:

1. In Google Cloud Console, aggiungi anche:
   ```
   http://localhost:5173/auth/v1/callback
   ```
   (o la porta che usi per il tuo server di sviluppo)

2. In Supabase, il redirect URL locale dovrebbe essere gestito automaticamente, ma verifica nelle impostazioni di Authentication.

### 3.2 Test in produzione

**IMPORTANTE**: Per Supabase OAuth, l'URL di redirect autorizzato in Google Cloud Console deve essere **sempre quello di Supabase**, non quello della tua app. Supabase gestirà il redirect finale alla tua app.

1. **Verifica configurazione Google Cloud Console:**
   - L'URL di redirect autorizzato deve essere: `https://[YOUR-PROJECT-REF].supabase.co/auth/v1/callback`
   - **NON** aggiungere l'URL della tua app (es. `https://poltrona.abruzzo.ai`) come redirect URI

2. **Verifica configurazione Supabase:**
   - Assicurati che Google Provider sia abilitato
   - Verifica che Client ID e Client Secret siano corretti

3. **Testa il flusso completo:**
   - Vai alla pagina di login/registrazione della tua app (es. `https://poltrona.abruzzo.ai/` o `https://poltrona.abruzzo.ai/[store-slug]`)
   - Clicca su **"Continua con Google"**
   - Dovresti essere reindirizzato a Google per l'autorizzazione
   - Dopo aver autorizzato, Google ti reindirizzerà a Supabase
   - Supabase processerà l'autenticazione e ti reindirizzerà di nuovo alla tua app
   - Dovresti essere autenticato e vedere il tuo profilo

4. **Verifica dopo l'autenticazione:**
   - Controlla che il profilo cliente sia stato creato correttamente
   - Verifica che il consenso privacy sia stato salvato (controlla localStorage nel browser)
   - Controlla che la foto profilo da Google sia stata importata (se disponibile)
   - Verifica che l'utente possa accedere alle funzionalità riservate ai clienti

### 3.3 Test per store multipli

Se hai store multipli con URL tipo `https://poltrona.abruzzo.ai/[store-slug]`:

- Il flusso OAuth funziona automaticamente per tutti gli store
- L'app rileva automaticamente lo store dall'URL e assegna l'utente allo store corretto
- Testa con diversi store per verificare che l'assegnazione funzioni correttamente

## Risoluzione problemi

### Errore: "redirect_uri_mismatch"

- Verifica che l'URI di reindirizzamento in Google Cloud Console corrisponda esattamente a quello configurato in Supabase
- Assicurati che non ci siano spazi o caratteri extra
- L'URL deve essere identico, incluso il protocollo (https://)

### Errore: "invalid_client"

- Verifica che il Client ID e Client Secret siano corretti
- Assicurati di aver copiato le credenziali corrette dal progetto giusto in Google Cloud Console

### L'utente non viene creato dopo OAuth

- Verifica che i trigger del database siano configurati correttamente
- Controlla i log di Supabase per errori durante la creazione del profilo
- Verifica che il ruolo "client" sia assegnato correttamente

### Il consenso privacy non viene salvato

- Verifica che il localStorage sia abilitato nel browser
- Controlla la console del browser per errori JavaScript
- Verifica che la versione della privacy policy sia corretta (attualmente "2.0")

## Note importanti

- **Sicurezza**: Non condividere mai il Client Secret pubblicamente. È già gestito in modo sicuro da Supabase.
- **Limitazioni**: Google OAuth ha limiti di quota. Per applicazioni con molti utenti, considera di richiedere un aumento della quota.
- **Email**: Gli utenti che si registrano con Google devono avere un account Google valido con email verificata.
- **Telefono**: Per gli utenti OAuth, il numero di telefono è opzionale e può essere aggiunto successivamente dal profilo.

## Supporto

Per problemi o domande:
- Consulta la [documentazione Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google)
- Consulta la [documentazione Google OAuth](https://developers.google.com/identity/protocols/oauth2)
- Contatta il team di sviluppo
