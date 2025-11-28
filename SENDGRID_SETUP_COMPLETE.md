# 🚀 Configurazione Completa SendGrid per Supabase

## Perché SendGrid?

✅ **Più affidabile** - 99.9% uptime  
✅ **Migliore deliverability** - Le email arrivano davvero  
✅ **Piano gratuito generoso** - 100 email/giorno (3000/mese)  
✅ **Dashboard completa** - Monitora tutti gli invii  
✅ **Nessun problema SMTP** - Usa API key invece di password  
✅ **Supporto eccellente** - Documentazione e community  

---

## 📋 Passo 1: Crea Account SendGrid

1. **Vai su** [https://sendgrid.com](https://sendgrid.com)
2. **Clicca "Start for Free"** o "Sign Up"
3. **Compila il form** con:
   - Email: la tua email
   - Password: una password sicura
   - Nome azienda: "Poltrona Barbershop" (o il tuo nome)
4. **Verifica l'email** che riceverai
5. **Completa il setup** (puoi saltare alcuni passaggi iniziali)

---

## 🔑 Passo 2: Crea API Key SendGrid

1. **Accedi al Dashboard SendGrid**
2. **Vai su** Settings → **API Keys** (menu laterale sinistro)
3. **Clicca** "Create API Key" (in alto a destra)
4. **Configura la chiave**:
   - **Name**: `Poltrona Barbershop App`
   - **API Key Permissions**: Seleziona **"Full Access"** (o almeno "Mail Send")
5. **Clicca** "Create & View"
6. **COPIA SUBITO LA CHIAVE** - La vedrai solo questa volta!
   - Formato: `SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - Salvala in un posto sicuro (non perderla!)

---

## 📧 Passo 3: Verifica Email Sender in SendGrid

### Opzione A: Verifica Singola Email (Più Veloce)

1. **Vai su** Settings → **Sender Authentication**
2. **Clicca** "Verify a Single Sender"
3. **Compila il form**:
   - **From Email Address**: `info@abruzzo.ai` (o l'email che vuoi usare)
   - **From Name**: `Poltrona Barbershop`
   - **Reply To**: `info@abruzzo.ai`
   - **Company Address**: Il tuo indirizzo
   - **City**: La tua città
   - **State**: La tua provincia
   - **Country**: Italy
   - **Zip Code**: Il tuo CAP
4. **Clicca** "Create"
5. **Verifica l'email** che riceverai da SendGrid
6. **Clicca il link** nella email per verificare

### Opzione B: Verifica Dominio (Raccomandato per Produzione)

Se hai accesso al DNS del dominio `abruzzo.ai`:
1. **Vai su** Settings → **Sender Authentication**
2. **Clicca** "Authenticate Your Domain"
3. **Inserisci il dominio**: `abruzzo.ai`
4. **Segui le istruzioni** per aggiungere i record DNS
5. **Attendi la verifica** (può richiedere fino a 48 ore)

---

## ⚙️ Passo 4: Configura SendGrid in Supabase

### 4.1 Configura SMTP in Supabase Authentication

1. **Vai su** [Supabase Dashboard](https://app.supabase.com)
2. **Seleziona il tuo progetto**
3. **Vai su** Settings → **Authentication** → **SMTP Settings**
4. **Abilita** "Enable Custom SMTP"
5. **Inserisci i dati SendGrid**:
   - **Host**: `smtp.sendgrid.net`
   - **Port**: `587` (o `465` per SSL)
   - **Username**: `apikey` (letteralmente questa parola)
   - **Password**: `[LA TUA API KEY DI SENDGRID]` (quella che hai copiato al Passo 2)
   - **Sender email**: `info@abruzzo.ai` (o l'email verificata)
   - **Sender name**: `Poltrona Barbershop`
6. **Clicca** "Save"

### 4.2 Testa la Configurazione

1. **Vai su** Authentication → **Users**
2. **Clicca** "Invite User"
3. **Inserisci** un'email di test (la tua email personale)
4. **Clicca** "Send Invite"
5. **Controlla** se ricevi l'email (dovrebbe arrivare in pochi secondi!)

---

## 🔧 Passo 5: Configura Edge Function (Se Usata)

Se usi la Edge Function `send-email`, configura anche lì:

1. **Vai su** Project Settings → **Edge Functions** → **Secrets**
2. **Aggiungi/Modifica** questi secrets:

| Nome | Valore |
|------|--------|
| `SMTP_HOST` | `smtp.sendgrid.net` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `apikey` |
| `SMTP_PASS` | `[LA TUA API KEY DI SENDGRID]` |
| `SMTP_FROM` | `info@abruzzo.ai` |
| `SMTP_FROM_NAME` | `Poltrona Barbershop` |

3. **Salva** tutti i secrets

---

## ✅ Passo 6: Verifica Finale

### Test 1: Invio Email da Supabase Auth
1. Vai su Authentication → Users → Invite User
2. Invia un invito a te stesso
3. ✅ Dovresti ricevere l'email in pochi secondi

### Test 2: Invio Email dalla Tua App
1. Fai una prenotazione di test
2. Controlla che il barbiere riceva l'email
3. Controlla che il cliente riceva l'email di conferma
4. ✅ Entrambe dovrebbero arrivare correttamente

### Test 3: Dashboard SendGrid
1. Vai su [SendGrid Dashboard](https://app.sendgrid.com)
2. Vai su **Activity** (menu laterale)
3. ✅ Dovresti vedere tutti gli invii email in tempo reale

---

## 📊 Monitoraggio

### Dashboard SendGrid
- **Activity**: Vedi tutti gli invii in tempo reale
- **Stats**: Statistiche su deliverability, bounce, spam
- **Suppressions**: Email bloccate o in bounce

### Log Supabase
- Controlla i log in Supabase Dashboard per eventuali errori

---

## 🆘 Risoluzione Problemi

### Problema: "Invalid API Key"
- ✅ Verifica di aver copiato correttamente l'API Key
- ✅ Controlla che l'API Key abbia permessi "Mail Send" o "Full Access"
- ✅ Verifica che non ci siano spazi prima/dopo la chiave

### Problema: "Email non verificata"
- ✅ Verifica l'email sender in SendGrid (Settings → Sender Authentication)
- ✅ Controlla la cartella spam
- ✅ Assicurati di aver cliccato il link di verifica nell'email

### Problema: "Email non arrivano"
- ✅ Controlla la dashboard SendGrid Activity per vedere lo stato
- ✅ Verifica che l'email destinatario sia valida
- ✅ Controlla la cartella spam del destinatario

### Problema: "Rate limit exceeded"
- ✅ Piano gratuito: 100 email/giorno
- ✅ Controlla quante email hai inviato oggi
- ✅ Se serve di più, considera l'upgrade del piano

---

## 💰 Piani SendGrid

| Piano | Prezzo | Limite Giornaliero | Limite Mensile |
|-------|--------|---------------------|----------------|
| **Free** | Gratis | 100 email/giorno | 3,000 email/mese |
| **Essentials** | $19.95/mese | 50,000 email/giorno | 1,500,000 email/mese |
| **Pro** | $89.95/mese | 100,000 email/giorno | 3,000,000 email/mese |

**Per un barbershop, il piano Free è più che sufficiente!**

---

## 🎉 Fatto!

Ora il tuo sistema di notifiche email funziona perfettamente con SendGrid!

✅ Email di invito da Supabase → Funzionano  
✅ Email notifiche al barbiere → Funzionano  
✅ Email conferma al cliente → Funzionano  
✅ Email annullamento → Funzionano  

**Nessun problema SMTP, tutto funziona via API!** 🚀

