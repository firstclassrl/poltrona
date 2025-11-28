# ⚡ N8N Quick Start - 10 Minuti

## 🎯 **Setup Rapido**

### 1. Crea Account N8N (2 minuti)

1. Vai su [n8n.cloud](https://n8n.cloud)
2. Crea account gratuito
3. **Fatto!** ✅

---

### 2. Configura Credenziali (3 minuti)

#### A. Supabase
1. **N8N** → Settings → Credentials → **Supabase**
2. **Compila**:
   ```
   Host: https://tlwxsluoqzdluzneugbe.supabase.co
   Service Role Key: [Da Supabase → Settings → API → service_role key]
   ```

#### B. Email (Resend - Più Semplice)
1. **Registrati** su [resend.com](https://resend.com) (gratis)
2. **Verifica** email sender
3. **Crea** API Key
4. **N8N** → Credentials → **HTTP Request**
   ```
   Name: Resend
   Header Auth:
     Name: Authorization
     Value: Bearer re_xxxxx
   ```

---

### 3. Crea Workflow Email (5 minuti)

#### Workflow: Send Email

1. **N8N** → Add Workflow
2. **Aggiungi nodo** → **Webhook**
   ```
   Path: send-email
   Method: POST
   ```
3. **Copia URL** webhook (es. `https://tuo-n8n.app.n8n.cloud/webhook/send-email`)

4. **Aggiungi nodo** → **Code** (Format Data)
   ```javascript
   const data = $input.first().json;
   return {
     to: data.to,
     subject: data.subject,
     html: data.html,
     text: data.text || data.html.replace(/<[^>]*>/g, '')
   };
   ```

5. **Aggiungi nodo** → **HTTP Request** (Resend)
   ```
   Method: POST
   URL: https://api.resend.com/emails
   Authentication: Resend (credenziale creata prima)
   Body:
   {
     "from": "info@abruzzo.ai",
     "to": "{{$json.to}}",
     "subject": "{{$json.subject}}",
     "html": "{{$json.html}}"
   }
   ```

6. **Attiva** workflow (toggle verde)

---

### 4. Configura Variabile Ambiente (1 minuto)

Nel tuo file `.env` (o variabili ambiente):

```env
VITE_N8N_BASE_URL=https://tuo-n8n.app.n8n.cloud
```

**Dove trovare l'URL**:
- N8N Dashboard → Workflows → Clicca sul workflow → Vedi URL webhook

---

## ✅ **Test**

1. **Crea** un appuntamento dall'app
2. **Controlla** N8N → Executions (dovresti vedere l'esecuzione)
3. **Verifica** email ricevuta!

---

## 🎉 **Fatto!**

Ora tutte le email passano per N8N:
- ✅ Nuova prenotazione
- ✅ Annullamento
- ✅ Nuovo cliente
- ✅ Email cliente

**Nessun problema SMTP!** 🚀

---

## 📖 **Guida Completa**

Vedi `N8N_SETUP_COMPLETO.md` per:
- Workflow avanzati
- Notifiche in-app
- Monitoraggio
- Troubleshooting

