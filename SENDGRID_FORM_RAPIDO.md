# ⚡ SendGrid - Form Rapido (Solo Campi Essenziali)

## 🎯 **Cosa Stai Facendo?**

Probabilmente stai verificando un **Single Sender** (email singola). Ecco come compilare velocemente:

---

## 📝 **Form SendGrid - Compilazione Rapida**

### **Campi OBBLIGATORI** (devi compilarli):

| Campo | Cosa Inserire | Esempio |
|-------|---------------|---------|
| **From Email Address** | La tua email | `info@abruzzo.ai` |
| **From Name** | Nome del mittente | `Poltrona Barbershop` |
| **Reply To** | Email per risposte | `info@abruzzo.ai` (stessa di sopra) |
| **Company Address** | Indirizzo azienda | `Via Roma 1` |
| **City** | Città | `Pescara` |
| **State** | Provincia | `PE` |
| **Country** | Paese | `Italy` |
| **Zip Code** | CAP | `65100` |

### **Campi OPZIONALI** (puoi saltarli o mettere valori generici):

| Campo | Cosa Fare |
|-------|-----------|
| **Website URL** | Lascia vuoto o metti `https://abruzzo.ai` |
| **Use case for your email** | Seleziona `Transactional` |
| **Additional contact information** | Lascia vuoto |
| **I agree to...** | ✅ **DEVI SPUNTARE** (obbligatorio) |

---

## 🚀 **Compilazione Ultra-Rapida (2 minuti)**

### **Copia e incolla questi valori:**

```
From Email Address: info@abruzzo.ai
From Name: Poltrona Barbershop
Reply To: info@abruzzo.ai
Company Address: [IL TUO INDIRIZZO]
City: [LA TUA CITTÀ]
State: [LA TUA PROVINCIA] (es. PE, CH, AQ, TE)
Country: Italy
Zip Code: [IL TUO CAP]
Website URL: (lascia vuoto o metti https://abruzzo.ai)
Use case: Transactional
I agree: ✅ SPUNTA
```

### **Clicca "Create" e verifica l'email!**

---

## ⚠️ **Se Chiede Verifica Dominio (Domain Authentication)**

Se invece ti chiede di verificare un **dominio intero** (più complesso):

### **Opzione A: Salta e usa Single Sender** ⭐ (PIÙ FACILE)

1. **Torna indietro** nel form
2. **Cerca** "Verify a Single Sender" invece di "Authenticate Your Domain"
3. **Usa quello** - è molto più semplice!

### **Opzione B: Se devi verificare il dominio**

Ti chiederà di aggiungere record DNS. Se non hai accesso al DNS, **usa Single Sender** (Opzione A).

---

## 🎯 **Cosa Fare Dopo**

1. **Compila il form** con i valori sopra
2. **Clicca "Create"**
3. **Controlla la tua email** (`info@abruzzo.ai`)
4. **Clicca il link** nell'email di SendGrid
5. **Fatto!** ✅

---

## 💡 **Trucco: Valori Minimi**

Se il form è troppo lungo, questi sono i **SOLI campi obbligatori**:

```
✅ From Email: info@abruzzo.ai
✅ From Name: Poltrona Barbershop
✅ Reply To: info@abruzzo.ai
✅ Address: [qualsiasi indirizzo valido]
✅ City: [qualsiasi città]
✅ State: [qualsiasi provincia]
✅ Country: Italy
✅ Zip: [qualsiasi CAP]
✅ I agree: ✅
```

**Tutto il resto puoi saltarlo o mettere valori generici!**

---

## 🆘 **Se Continua a Dare Errore**

1. **Assicurati** che l'email `info@abruzzo.ai` esista e funzioni
2. **Controlla** la cartella spam
3. **Prova** con un'altra email (es. la tua email personale)
4. **Usa** "Verify a Single Sender" invece di dominio

---

## ✅ **Dopo la Verifica**

Una volta verificato:
1. **Crea l'API Key** (Settings → API Keys)
2. **Configura in Supabase** (vedi `SENDGRID_SETUP_COMPLETE.md`)
3. **Testa!**

---

**Non ti preoccupare del form lungo - compila solo i campi obbligatori e vai avanti!** 🚀

