# 📧 Deploy Edge Function per Email - Supabase

Questa guida spiega come deployare la Edge Function per l'invio email usando il tuo SMTP configurato (info@abruzzo.ai).

## 🚀 Deploy della Edge Function

### 1. Installa Supabase CLI (se non già installato)

```bash
npm install -g supabase
```

### 2. Login a Supabase

```bash
supabase login
```

### 3. Collega il progetto

```bash
cd "/Users/antonietto/Documents/Abruzzo.AI/Poltrona - Beta 1"
supabase link --project-ref TUO_PROJECT_REF
```

### 4. Configura le variabili d'ambiente SMTP

#### Opzione A: SendGrid (Raccomandato) ⭐

1. **Crea account SendGrid**: Vai su [sendgrid.com](https://sendgrid.com) e registrati (gratis, 100 email/giorno)
2. **Crea API Key**: Settings → API Keys → Create API Key → "Full Access"
3. **Verifica email sender**: Settings → Sender Authentication → Verify a Single Sender
4. **Configura in Supabase**:
   - Vai su **Project Settings** → **Edge Functions** → **Secrets**
   - Aggiungi:

| Nome | Valore |
|------|--------|
| `SMTP_HOST` | `smtp.sendgrid.net` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `apikey` (letteralmente questa parola) |
| `SMTP_PASS` | `[LA TUA API KEY DI SENDGRID]` (es. SG.xxxxx...) |
| `SMTP_FROM` | `info@abruzzo.ai` (email verificata in SendGrid) |
| `SMTP_FROM_NAME` | `Poltrona - Barbershop` |

📖 **Guida completa**: Vedi `SENDGRID_SETUP_COMPLETE.md` nella root del progetto

#### Opzione B: Altri Provider SMTP

Nel dashboard di Supabase:
1. Vai su **Project Settings** → **Edge Functions** → **Secrets**
2. Aggiungi le seguenti variabili:

| Nome | Valore |
|------|--------|
| `SMTP_HOST` | `smtp.tuoprovider.com` (es. smtp.gmail.com) |
| `SMTP_PORT` | `587` (o `465` per SSL) |
| `SMTP_USER` | `info@abruzzo.ai` |
| `SMTP_PASS` | `la-tua-password-smtp` |
| `SMTP_FROM` | `info@abruzzo.ai` |
| `SMTP_FROM_NAME` | `Poltrona - Barbershop` |

### 5. Deploy della funzione

```bash
supabase functions deploy send-email
```

## 🧪 Test della funzione

Dopo il deploy, puoi testare la funzione:

```bash
curl -X POST 'https://TUO_PROJECT.supabase.co/functions/v1/send-email' \
  -H 'Authorization: Bearer TUA_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"test": true}'
```

## 📝 Note

- **SendGrid (Raccomandato)**: Usa API key invece di password, più affidabile
- Se usi Gmail, devi abilitare "App password" nelle impostazioni di sicurezza Google
- Per altri provider SMTP, consulta la loro documentazione

## 🔧 Configurazione SMTP in Supabase Authentication

**IMPORTANTE**: Configura anche SMTP in Authentication per le email di invito:

1. Vai su **Settings** → **Authentication** → **SMTP Settings**
2. Abilita "Enable Custom SMTP"
3. Inserisci le stesse credenziali (per SendGrid: host `smtp.sendgrid.net`, user `apikey`, pass = API key)
4. Salva

Questo risolverà l'errore 525 5.7.13 che stavi ricevendo!

