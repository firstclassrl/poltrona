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

Nel dashboard di Supabase:
1. Vai su **Project Settings** → **Edge Functions**
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

- Se usi Gmail, devi abilitare "App password" nelle impostazioni di sicurezza Google
- Per altri provider SMTP, consulta la loro documentazione
- Le credenziali SMTP sono già configurate nel tuo Supabase per l'autenticazione - puoi usare le stesse!

## 🔧 Configurazione SMTP già presente in Supabase

Se hai già configurato SMTP in Supabase per le email di autenticazione:
1. Vai su **Authentication** → **Email Templates** → **SMTP Settings**
2. Copia le stesse credenziali nelle variabili d'ambiente della Edge Function

