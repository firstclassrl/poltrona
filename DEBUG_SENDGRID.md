# 🔍 Debug SendGrid - Risoluzione Errori

## ❌ Errore: "Error sending invite email"

Questo significa che Supabase non riesce a inviare email. Verifichiamo passo per passo:

---

## ✅ **CHECKLIST DI VERIFICA**

### 1. **Verifica Email Sender in SendGrid** ⭐ (MOLTO IMPORTANTE!)

L'email sender DEVE essere verificata in SendGrid prima di funzionare!

1. **Vai su** [SendGrid Dashboard](https://app.sendgrid.com)
2. **Vai su** Settings → **Sender Authentication**
3. **Controlla** se vedi `info@abruzzo.ai` (o l'email che usi)
4. **Stato deve essere**: ✅ **"Verified"** (verde)

❌ **Se NON è verificata:**
- Clicca su "Verify a Single Sender"
- Compila il form (vedi `SENDGRID_FORM_RAPIDO.md`)
- **VERIFICA L'EMAIL** che riceverai (controlla anche spam!)
- Clicca il link nella email

✅ **Solo dopo la verifica** l'email funzionerà!

---

### 2. **Verifica Configurazione Supabase SMTP**

1. **Vai su** Supabase Dashboard
2. **Settings** → **Authentication** → **SMTP Settings**
3. **Verifica** che sia così:

```
✅ Enable Custom SMTP: SPUNTATO
Host: smtp.sendgrid.net
Port: 587
Username: apikey (esattamente questa parola, minuscolo)
Password: YOUR_SENDGRID_API_KEY (la tua API Key completa)
Sender email: info@abruzzo.ai (DEVE essere quella verificata in SendGrid!)
Sender name: Poltrona Barbershop
```

⚠️ **Errori comuni:**
- ❌ Username scritto male (deve essere esattamente `apikey`)
- ❌ Spazi prima/dopo l'API Key
- ❌ Email sender diversa da quella verificata in SendGrid
- ❌ Porta sbagliata (deve essere `587`)

---

### 3. **Verifica API Key in SendGrid**

1. **Vai su** SendGrid Dashboard
2. **Settings** → **API Keys**
3. **Controlla** che la chiave esista
4. **Verifica** che abbia permessi:
   - ✅ "Full Access" OPPURE
   - ✅ "Mail Send" (almeno questo)

---

### 4. **Controlla i Log di Supabase**

1. **Vai su** Supabase Dashboard
2. **Logs** → **Auth Logs** (menu laterale)
3. **Cerca** errori recenti
4. **Leggi** il messaggio di errore completo

Cosa cercare:
- `525 5.7.13` → Email sender non verificata
- `Invalid API Key` → API Key sbagliata
- `Authentication failed` → Username/password errati

---

## 🔧 **SOLUZIONI RAPIDE**

### **Soluzione 1: Email Sender Non Verificata** (90% dei casi)

**Sintomo**: Errore 525 o "Sending temporarily disabled"

**Fix**:
1. Vai su SendGrid → Settings → Sender Authentication
2. Verifica che `info@abruzzo.ai` sia ✅ Verified
3. Se non lo è, verificala ora
4. **Aspetta 2-3 minuti** dopo la verifica
5. Riprova

---

### **Soluzione 2: Username Sbagliato**

**Sintomo**: "Authentication failed"

**Fix**:
- Username DEVE essere esattamente: `apikey` (minuscolo, senza spazi)
- NON `apikey@sendgrid.com`
- NON `SG.xxxxx`
- Solo `apikey`

---

### **Soluzione 3: Email Sender Diversa**

**Sintomo**: Email non arriva o errore generico

**Fix**:
- L'email in "Sender email" in Supabase DEVE essere quella verificata in SendGrid
- Se hai verificato `info@abruzzo.ai` in SendGrid, usa quella
- Se hai verificato un'altra email, usa quella

---

### **Soluzione 4: Test con Email Diversa**

Prova a verificare un'altra email in SendGrid:

1. **SendGrid** → Settings → Sender Authentication → Verify a Single Sender
2. **Usa** la tua email personale (es. `tuaemail@gmail.com`)
3. **Verifica** l'email
4. **In Supabase**, cambia "Sender email" con quella nuova
5. **Salva** e riprova

---

## 🧪 **TEST PASSO-PASSO**

### Test 1: Verifica SendGrid
```
1. SendGrid Dashboard → Settings → Sender Authentication
2. Vedi email verificata? ✅
3. Se NO → Verificala ora
```

### Test 2: Verifica Supabase Config
```
1. Supabase → Settings → Authentication → SMTP Settings
2. Enable Custom SMTP: ✅
3. Host: smtp.sendgrid.net ✅
4. Port: 587 ✅
5. Username: apikey ✅
6. Password: [la tua API key] ✅
7. Sender email: [email verificata in SendGrid] ✅
```

### Test 3: Test Invio
```
1. Authentication → Users → Invite User
2. Invia a te stesso
3. Controlla email (anche spam!)
```

---

## 🆘 **SE ANCORA NON FUNZIONA**

### Opzione A: Usa Email Personale Temporaneamente

1. **SendGrid** → Verifica la tua email personale (es. Gmail)
2. **Supabase** → Cambia "Sender email" con quella
3. **Testa** - dovrebbe funzionare subito

### Opzione B: Controlla Rate Limits

- Piano gratuito SendGrid: 100 email/giorno
- Controlla se hai superato il limite
- Vai su SendGrid Dashboard → Activity

### Opzione C: Verifica DNS (se usi dominio)

Se stai usando un dominio personalizzato:
- Verifica che i record DNS siano corretti
- Può richiedere fino a 48 ore

---

## 📋 **CHECKLIST FINALE**

Prima di riprovare, verifica:

- [ ] Email sender verificata in SendGrid (✅ verde)
- [ ] API Key corretta e con permessi
- [ ] Username = `apikey` (esatto)
- [ ] Password = API Key completa (SG.xxxxx)
- [ ] Sender email = email verificata in SendGrid
- [ ] Port = 587
- [ ] Host = smtp.sendgrid.net
- [ ] Enable Custom SMTP = ✅ spuntato
- [ ] Salvato tutto in Supabase

---

## 💡 **TRUCCO: Test Diretto SendGrid**

Per verificare che SendGrid funzioni:

1. **SendGrid Dashboard** → Email API → **Send Test Email**
2. **Invia** una email di test
3. **Se arriva** → SendGrid funziona, problema in Supabase config
4. **Se non arriva** → Problema in SendGrid (verifica sender)

---

**Inizia dalla verifica dell'email sender - è il problema più comune!** 🔍

