# ⚡ Configura SendGrid in Supabase - GUIDA RAPIDA

## ✅ Hai l'API Key! Ora configuriamola:

**La tua API Key**: `YOUR_SENDGRID_API_KEY` (inserisci qui la tua API Key)

---

## 🚀 **PASSO 1: Configura in Supabase Authentication** (2 minuti)

### 1. Vai su Supabase Dashboard
- [https://app.supabase.com](https://app.supabase.com)
- Seleziona il tuo progetto

### 2. Vai su SMTP Settings
- **Settings** (menu laterale sinistro)
- **Authentication** (sotto Settings)
- **SMTP Settings** (tab in alto)

### 3. Abilita e Compila

✅ **Abilita** "Enable Custom SMTP"

Inserisci questi valori:

| Campo | Valore da Inserire |
|-------|-------------------|
| **Host** | `smtp.sendgrid.net` |
| **Port** | `587` |
| **Username** | `apikey` (letteralmente questa parola) |
| **Password** | `YOUR_SENDGRID_API_KEY` (la tua API Key completa) |
| **Sender email** | `info@abruzzo.ai` (o l'email che hai verificato in SendGrid) |
| **Sender name** | `Poltrona Barbershop` |

### 4. Salva
- Clicca **"Save"** in basso

---

## 🧪 **PASSO 2: Test Immediato** (1 minuto)

### Testa che funzioni:

1. **Vai su** Authentication → **Users**
2. **Clicca** "Invite User" (in alto a destra)
3. **Inserisci** la tua email personale
4. **Clicca** "Send Invite"
5. **Controlla** la tua email - dovresti riceverla in pochi secondi! ✅

---

## 🔧 **PASSO 3: Configura Edge Function** (se usata)

Se usi la Edge Function `send-email`:

1. **Vai su** Project Settings → **Edge Functions** → **Secrets**
2. **Aggiungi/Modifica** questi secrets:

| Nome Secret | Valore |
|-------------|--------|
| `SMTP_HOST` | `smtp.sendgrid.net` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `apikey` |
| `SMTP_PASS` | `YOUR_SENDGRID_API_KEY` (la tua API Key completa) |
| `SMTP_FROM` | `info@abruzzo.ai` |
| `SMTP_FROM_NAME` | `Poltrona Barbershop` |

3. **Salva** tutti i secrets

---

## ✅ **Verifica Finale**

### Dopo la configurazione, testa:

1. ✅ **Invio email da Supabase Auth** → Dovrebbe funzionare
2. ✅ **Invio email dalla tua app** → Dovrebbe funzionare
3. ✅ **Nessun errore 525** → Risolto!

---

## 🎉 **Fatto!**

Ora tutte le email funzionano:
- ✅ Email di invito da Supabase
- ✅ Email notifiche al barbiere
- ✅ Email conferma al cliente
- ✅ Email annullamento

**Nessun problema SMTP, tutto via SendGrid API!** 🚀

---

## ⚠️ **IMPORTANTE: Sicurezza**

⚠️ **NON condividere mai questa API Key pubblicamente!**

- ✅ È già salvata in questo file (locale)
- ❌ Non committare questo file su Git
- ❌ Non condividerla in chat pubbliche
- ✅ Usala solo in Supabase Dashboard

---

## 🆘 **Se Non Funziona**

1. **Verifica** che l'email sender sia verificata in SendGrid
2. **Controlla** che l'API Key abbia permessi "Full Access" o "Mail Send"
3. **Verifica** che non ci siano spazi prima/dopo l'API Key
4. **Controlla** i log in Supabase per eventuali errori

---

**Ora vai su Supabase e configura! In 3 minuti è fatto!** ⚡

