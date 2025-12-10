# 📝 Linguaggio e Tecnologie API - Poltrona

## ✅ **NON SERVE CREARE UNA NUOVA API!**

L'API esiste già e funziona perfettamente! Basta solo configurare SendGrid.

---

## 🔧 **Linguaggio Attuale**

### **Supabase Edge Functions: Deno/TypeScript**

La tua Edge Function `send-email` è già scritta in:
- **Linguaggio**: TypeScript
- **Runtime**: Deno (non Node.js)
- **Percorso**: `supabase/functions/send-email/index.ts`

### Esempio del codice esistente:

```typescript
// supabase/functions/send-email/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  // La funzione esiste già e funziona!
  // Supporta SMTP diretto (Aruba, Gmail, SendGrid, ecc.)
})
```

---

## 🎯 **Cosa Devi Fare**

### **OPZIONE 1: Configurazione SMTP (Più Semplice)** ⭐

**NON serve modificare codice!** Basta configurare SendGrid nelle impostazioni:

1. **Supabase Dashboard** → Settings → Authentication → SMTP Settings
2. Inserisci le credenziali SendGrid:
   - Host: `smtp.sendgrid.net`
   - Port: `587`
   - Username: `apikey`
   - Password: `[LA TUA API KEY]`
3. **Fatto!** La Edge Function esistente funzionerà automaticamente

### **OPZIONE 2: Modificare la Edge Function (Solo se necessario)**

Se in futuro vuoi modificare la Edge Function:

#### Linguaggio da usare:
- ✅ **TypeScript** (Deno)
- ❌ Non Node.js
- ❌ Non Python
- ❌ Non altri linguaggi

#### Come modificare:

1. **Modifica il file**:
   ```
   supabase/functions/send-email/index.ts
   ```

2. **Sintassi Deno** (diversa da Node.js):
   ```typescript
   // ✅ CORRETTO - Deno
   import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
   
   // ❌ SBAGLIATO - Node.js
   // import { serve } from 'express'
   ```

3. **Deploy**:
   ```bash
   supabase functions deploy send-email
   ```

---

## 📚 **Stack Tecnologico Completo**

| Componente | Linguaggio | Framework/Runtime |
|------------|------------|-------------------|
| **Frontend** | TypeScript | React + Vite |
| **Edge Functions** | TypeScript | Deno |
| **Database** | SQL | PostgreSQL (Supabase) |
| **Email Service** | - | SendGrid (via SMTP) |

---

## 🚀 **Per Iniziare Subito**

### **Non serve scrivere codice!**

1. Segui la guida `SENDGRID_SETUP_COMPLETE.md`
2. Configura SendGrid in Supabase Dashboard
3. Testa l'invio email
4. **Fatto!** 🎉

---

## 💡 **Se Vuoi Modificare la Edge Function**

### Esempio: Aggiungere logging

```typescript
// supabase/functions/send-email/index.ts
serve(async (req) => {
  const { to, subject, html, text } = await req.json()
  
  // Aggiungi qui il tuo codice
  console.log(`📧 Invio email a: ${to}`)
  
  // ... resto del codice esistente
})
```

### Esempio: Aggiungere validazione

```typescript
// Valida l'email destinatario
if (!to || !to.includes('@')) {
  return new Response(
    JSON.stringify({ error: 'Email non valida' }),
    { status: 400 }
  )
}
```

---

## 📖 **Risorse Deno**

- **Documentazione**: [deno.land](https://deno.land)
- **Supabase Functions**: [supabase.com/docs/guides/functions](https://supabase.com/docs/guides/functions)
- **TypeScript**: Stessa sintassi del frontend

---

## ✅ **Riepilogo**

1. ✅ **API esiste già** - Non serve crearla
2. ✅ **Linguaggio**: TypeScript (Deno)
3. ✅ **Basta configurare SendGrid** - Nessun codice da scrivere
4. ✅ **Se modifichi**: Usa TypeScript/Deno

**Inizia subito con la configurazione SendGrid!** 🚀










