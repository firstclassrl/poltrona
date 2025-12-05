# Deploy Edge Function send-email per Resend

Questa Edge Function agisce da proxy server-side per chiamare Resend API, evitando problemi CORS quando si chiama dal browser.

## Deploy

```bash
supabase functions deploy send-email
```

## Configurazione Variabile d'Ambiente

**IMPORTANTE**: Devi configurare la variabile d'ambiente `RESEND_API_KEY` in Supabase:

1. Vai su [Supabase Dashboard](https://app.supabase.com)
2. Seleziona il tuo progetto
3. Vai su **Settings** → **Edge Functions** → **Secrets**
4. Aggiungi una nuova secret:
   - **Name**: `RESEND_API_KEY`
   - **Value**: `re_JgwdUFcW_JQSzhzNB7qcRTipXsZGKcA9Y`
5. Clicca **Save**

## Verifica

Dopo il deploy, la funzione sarà disponibile a:
`https://TUO_PROJECT.supabase.co/functions/v1/send-email`

## Test

```bash
curl -X POST 'https://TUO_PROJECT.supabase.co/functions/v1/send-email' \
  -H 'Authorization: Bearer TUO_SUPABASE_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "to": "test@example.com",
    "subject": "Test Email",
    "html": "<h1>Test</h1>",
    "text": "Test"
  }'
```







