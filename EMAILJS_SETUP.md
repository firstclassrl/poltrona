# Configurazione EmailJS per Notifiche Email

## 🎯 **Perché EmailJS?**

EmailJS risolve il problema CORS che abbiamo con Resend. Funziona direttamente dal browser senza bisogno di server backend.

## 📧 **Configurazione EmailJS**

### **1. Registrati su EmailJS**

1. Vai su [emailjs.com](https://emailjs.com)
2. Crea un account gratuito
3. Verifica la tua email

### **2. Configura il Servizio Email**

1. **Vai su "Email Services"**
2. **Clicca "Add New Service"**
3. **Scegli il tuo provider email** (Gmail, Outlook, Yahoo, etc.)
4. **Configura la connessione** seguendo le istruzioni
5. **Copia il Service ID** (es. `service_xxxxx`)

### **3. Crea il Template Email**

1. **Vai su "Email Templates"**
2. **Clicca "Create New Template"**
3. **Usa questo template**:

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Nuovo Cliente Registrato</title>
</head>
<body>
    <h1>Nuovo Cliente Registrato - {{shop_name}}</h1>
    
    <p>Un nuovo cliente si è appena registrato nel tuo sistema di gestione!</p>
    
    <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3>Dettagli Cliente:</h3>
        <p><strong>Nome:</strong> {{client_name}}</p>
        <p><strong>Email:</strong> {{client_email}}</p>
        <p><strong>Telefono:</strong> {{client_phone}}</p>
        <p><strong>Data Registrazione:</strong> {{registration_date}}</p>
    </div>
    
    <p>Questa email è stata generata automaticamente dal sistema di gestione.</p>
    <p>{{shop_name}} - Sistema di Gestione Clienti</p>
</body>
</html>
```

4. **Configura i parametri**:
   - **To Email**: `{{to_email}}`
   - **Subject**: `Nuovo Cliente Registrato - {{client_name}}`
   - **From Name**: `{{from_name}}`

5. **Copia il Template ID** (es. `template_xxxxx`)

### **4. Ottieni la Public Key**

1. **Vai su "Account" > "General"**
2. **Copia la Public Key** (es. `xxxxxxxxxxxxxxxx`)

### **5. Configura le Variabili d'Ambiente**

Aggiorna il file `.env`:

```env
VITE_EMAILJS_SERVICE_ID=service_xxxxx
VITE_EMAILJS_TEMPLATE_ID=template_xxxxx
VITE_EMAILJS_PUBLIC_KEY=xxxxxxxxxxxxxxxx
```

## 🚀 **Test del Sistema**

### **1. Riavvia l'Applicazione**

```bash
npm run dev
```

### **2. Testa la Registrazione**

1. **Vai alla pagina di registrazione**
2. **Registra un nuovo cliente**
3. **Controlla la console** per messaggi di successo
4. **Verifica la tua email** per la notifica

### **3. Verifica i Log**

Nella console dovresti vedere:
- ✅ `"Email notifica nuovo cliente inviata via EmailJS"`
- ❌ Non più errori CORS

## 📊 **Limiti EmailJS Gratuito**

- **200 email/mese** gratuitamente
- **Nessun limite di dominio**
- **Funziona dal browser** (nessun problema CORS)
- **Facile da configurare**

## 🔧 **Troubleshooting**

### **Email non arriva**
1. **Controlla la cartella spam**
2. **Verifica le variabili d'ambiente**
3. **Controlla i log di EmailJS** nel dashboard

### **Errore "EmailJS non configurato"**
1. **Verifica il file `.env`**
2. **Riavvia l'applicazione**
3. **Controlla che le variabili inizino con `VITE_`**

### **Errore nel template**
1. **Verifica i nomi dei parametri** nel template
2. **Controlla che corrispondano** a quelli nel codice

## 🎉 **Vantaggi di EmailJS**

- ✅ **Nessun problema CORS**
- ✅ **Funziona dal browser**
- ✅ **Facile da configurare**
- ✅ **Gratuito fino a 200 email/mese**
- ✅ **Supporta tutti i provider email**
- ✅ **Template personalizzabili**

Una volta configurato EmailJS, il sistema di notifiche funzionerà perfettamente!
