# 📖 Come Usare il Sistema Waitlist - Guida Utente

## 🎯 COSA FA IL SISTEMA WAITLIST?

Il sistema waitlist permette ai clienti di mettersi in coda quando non ci sono posti disponibili. Quando qualcuno cancella un appuntamento, il primo cliente in coda viene automaticamente notificato.

---

## 👤 PER I CLIENTI

### 📍 DOVE ANDARE

1. **Accedi all'app** con il tuo account cliente
2. **Vai su "Prenota"** nel menu (icona calendario)
3. **Scorri in basso** fino alla sezione **"Mettiti in Coda"**

### 📝 COME ISCRIVERSI ALLA WAITLIST

1. **Seleziona i giorni** in cui vorresti un posto (fino a 7 giorni in futuro)
   - Clicca sui pulsanti con le date per selezionarle
   - Le date selezionate diventano gialle/arancioni

2. **(Opzionale) Scegli servizio e barbiere preferiti**
   - Se hai preferenze specifiche, selezionale
   - Se non selezioni nulla, accetti qualsiasi posto disponibile

3. **Clicca "Mettiti in Coda"**
   - Riceverai un messaggio di conferma
   - La tua richiesta apparirà nella lista qui sotto

### 🔔 COSA SUCCEDE DOPO

- **Sei in attesa**: Il tuo status è "In attesa"
- **Quando si libera un posto**:
  - Ricevi una **notifica in-app** (campanella in alto a destra)
  - Ricevi una **email** (se configurata)
  - Hai **15 minuti** per prenotare
  - Clicca sulla notifica per andare direttamente alla prenotazione

- **Se non prenoti entro 15 minuti**:
  - Il posto viene offerto al prossimo cliente in coda
  - La tua richiesta rimane in lista per altri giorni selezionati

### 📋 VEDERE LE TUE RICHIESTE

Nella stessa pagina "Prenota", in basso vedi:
- **Tutte le tue richieste in lista d'attesa**
- **Status di ogni richiesta**:
  - 🟦 **In attesa**: Aspettando un posto
  - 🟨 **Notificato**: Ti è stato offerto un posto (hai 15 minuti)
  - 🟩 **Prenotato**: Hai prenotato con successo
  - ⬜ **Scaduto**: La notifica è scaduta

### ❌ RIMUOVERSI DALLA CODA

Clicca su "Rimuovi" accanto a una richiesta per uscire dalla coda.

---

## 👨‍💼 PER LO STAFF (Barbieri/Admin)

### 📍 DOVE ANDARE

1. **Accedi all'app** con il tuo account staff/admin
2. **Vai su "Lista d'Attesa"** nel menu laterale (icona orologio ⏰)
3. Vedi la **Dashboard Waitlist** completa

### 📊 COSA VEDI NELLA DASHBOARD

#### Statistiche Generali (in alto)
- **In Attesa**: Quanti clienti stanno aspettando
- **Notificati**: Quanti hanno ricevuto una notifica
- **Prenotati**: Quanti hanno prenotato dopo la notifica
- **Tasso Conversione**: Percentuale di successo (notificati → prenotati)

#### Statistiche per Data
- Clicca su una data per vedere i dettagli
- Vedi quanti clienti sono in attesa per ogni data
- Filtra la lista per data specifica

#### Lista Completa Entry Waitlist
- **Nome cliente** e contatti
- **Date preferite**
- **Servizio e barbiere** (se specificati)
- **Status** della richiesta
- **Quando è stata creata**
- **Quando scade** (se notificato)

### 🔔 NOTIFICHE STAFF

Ricevi notifiche automatiche quando:
- **Un nuovo cliente si iscrive** e ci sono già >3 clienti in coda
- **Ci sono >5 clienti in waitlist** (summary periodico)

Le notifiche appaiono nella **campanella** in alto a destra.

---

## 🔄 FLUSSO COMPLETO DEL SISTEMA

### Scenario 1: Cliente si iscrive alla waitlist

```
1. Cliente va su "Prenota"
2. Non trova posti disponibili
3. Scorre in basso → "Mettiti in Coda"
4. Seleziona date (es: 15/01, 16/01, 17/01)
5. Clicca "Mettiti in Coda"
6. ✅ Cliente iscritto con status "waiting"
```

### Scenario 2: Qualcuno cancella un appuntamento

```
1. Un appuntamento viene cancellato (es: 15/01 alle 10:00)
2. Sistema cerca il primo cliente in waitlist per quella data
3. Sistema verifica matching servizio/barbiere (se specificati)
4. Sistema invia notifica al primo cliente idoneo
5. ✅ Cliente riceve:
   - Notifica in-app (campanella)
   - Email (se configurata)
   - Status cambia a "notified"
   - Timeout di 15 minuti parte
```

### Scenario 3: Cliente prenota dopo notifica

```
1. Cliente clicca sulla notifica
2. Viene portato alla pagina prenotazione
3. Data, servizio e barbiere sono già pre-compilati
4. Cliente conferma la prenotazione
5. ✅ Status waitlist cambia a "booked"
6. ✅ Appuntamento creato
```

### Scenario 4: Cliente NON prenota entro 15 minuti

```
1. Passano 15 minuti dalla notifica
2. Sistema chiama handle_waitlist_notification_timeout()
3. Status del primo cliente cambia a "notification_expired"
4. Sistema cerca il prossimo cliente in coda
5. Sistema invia notifica al secondo cliente
6. ✅ Secondo cliente riceve notifica
```

---

## 🎨 DOVE TROVARE TUTTO NELL'APP

### Menu Cliente:
```
🏠 Dashboard
📅 Prenota          ← QUI puoi iscriverti alla waitlist
👤 Il Mio Profilo
📋 Le Mie Prenotazioni
🔔 Notifiche        ← QUI vedi le notifiche waitlist
```

### Menu Staff:
```
🏠 Dashboard
📅 Calendario
👥 Clienti
⏰ Lista d'Attesa    ← QUI vedi la dashboard waitlist
✂️ Servizi
🛍️ Prodotti
💬 Chat
👤 Poltrone
🏢 Negozio
⚙️ Opzioni
🔔 Notifiche        ← QUI vedi le notifiche staff
```

---

## ⚙️ CONFIGURAZIONE NECESSARIA

### ✅ Già Fatto (se hai eseguito lo script SQL):
- ✅ Database configurato
- ✅ Funzioni e trigger creati
- ✅ Notifiche in-app funzionanti
- ✅ Frontend integrato

### 🔧 Da Configurare (opzionale ma consigliato):

1. **Email Notifiche**:
   - Configura webhook Supabase → N8N
   - Vedi `docs/WAITLIST_SETUP.md` per dettagli

2. **Job Schedulato per Timeout**:
   - Configura cron job per chiamare `handle_waitlist_notification_timeout()` ogni 5 minuti
   - Vedi `docs/WAITLIST_SETUP.md` per dettagli

---

## 🧪 TESTARE IL SISTEMA

### Test Base:

1. **Come Cliente**:
   - Iscriviti alla waitlist per una data futura
   - Verifica che la richiesta appaia nella lista

2. **Come Staff**:
   - Vai su "Lista d'Attesa"
   - Verifica che la richiesta del cliente appaia

3. **Test Notifica**:
   - Come staff, cancella un appuntamento per quella data
   - Verifica che il cliente riceva la notifica
   - Verifica che la notifica sia cliccabile

4. **Test Prenotazione**:
   - Come cliente, clicca sulla notifica
   - Verifica che la prenotazione sia pre-compilata
   - Completa la prenotazione
   - Verifica che lo status waitlist cambi a "booked"

---

## ❓ FAQ

### Q: Quanti giorni posso selezionare?
**R**: Fino a 7 giorni in futuro.

### Q: Posso essere in waitlist per più date?
**R**: Sì, puoi selezionare più date nella stessa richiesta.

### Q: Cosa succede se non prenoto entro 15 minuti?
**R**: Il posto viene offerto al prossimo cliente in coda. La tua richiesta rimane valida per le altre date selezionate.

### Q: Posso specificare preferenze?
**R**: Sì, puoi scegliere servizio e/o barbiere preferiti. Se non specifichi nulla, accetti qualsiasi posto disponibile.

### Q: Come vedo se sono stato notificato?
**R**: 
- Notifica nella campanella (in alto a destra)
- Status nella lista waitlist cambia a "Notificato"
- Email (se configurata)

### Q: Lo staff vede tutte le richieste?
**R**: Sì, lo staff vede tutte le richieste del proprio negozio nella dashboard "Lista d'Attesa".

---

## 🐛 PROBLEMI COMUNI

### "Non vedo la sezione waitlist"
- Verifica di essere loggato come cliente
- Verifica che la pagina "Prenota" sia caricata completamente
- Scrolla in basso nella pagina

### "Non ricevo notifiche"
- Verifica che il cliente abbia `user_id` collegato nella tabella `clients`
- Verifica che l'appuntamento sia stato cancellato correttamente
- Controlla i log Supabase per errori

### "La dashboard staff è vuota"
- Verifica di essere loggato come staff/admin
- Verifica che ci siano richieste waitlist per il tuo negozio
- Controlla che `shop_id` sia corretto

---

## 📞 SUPPORTO

Se hai problemi:
1. Verifica che lo script SQL sia stato eseguito correttamente
2. Controlla la console browser per errori
3. Verifica i log Supabase per errori database
4. Consulta `docs/WAITLIST_SETUP.md` per troubleshooting

