# Configurazione Stripe per Poltrona

Questa guida spiega come configurare Stripe per il sistema di abbonamento.

## 1. Prerequisiti

- Account Stripe attivo (o account test per sviluppo)
- Accesso alla [Stripe Dashboard](https://dashboard.stripe.com)

## 2. Configurazione Prodotti e Prezzi

### Creare il Prodotto

1. Vai su **Products** → **Add Product**
2. Nome: `Abbonamento Poltrona`
3. Descrizione: `Abbonamento mensile o annuale per gestire il tuo negozio`

### Creare i Prezzi

Dopo aver creato il prodotto, aggiungi due prezzi:

**Prezzo Mensile:**
- Tipo: Ricorrente
- Importo: €29/mese (o il prezzo desiderato)
- Intervallo: Mensile

**Prezzo Annuale:**
- Tipo: Ricorrente  
- Importo: €290/anno (o il prezzo desiderato)
- Intervallo: Annuale

> **Nota:** Copia i Price ID (es. `price_1A2B3C...`) per configurarli nell'app.

## 3. Configurazione Webhook

1. Vai su **Developers** → **Webhooks**
2. Clicca **Add Endpoint**
3. URL: `https://tlwxsluoqzdluzneugbe.supabase.co/functions/v1/stripe-webhook`
4. Seleziona questi eventi:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
5. Clicca **Add Endpoint**
6. Copia il **Signing Secret** (inizia con `whsec_...`)

## 4. Configurazione Customer Portal

1. Vai su **Settings** → **Billing** → **Customer Portal**
2. Abilita le opzioni desiderate:
   - Visualizza storico fatture ✓
   - Aggiorna metodo pagamento ✓
   - Cancella abbonamento ✓
3. Salva le modifiche

## 5. Ottenere le Chiavi API

1. Vai su **Developers** → **API Keys**
2. Copia la **Publishable Key** (inizia con `pk_test_...` o `pk_live_...`)
3. Copia la **Secret Key** (inizia con `sk_test_...` o `sk_live_...`)

## 6. Configurazione Variabili Ambiente

### Frontend (.env)

Aggiungi al file `.env` nella root del progetto:

```env
# Stripe
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
VITE_STRIPE_PRICE_MONTHLY=price_...
VITE_STRIPE_PRICE_YEARLY=price_...
```

### Supabase Edge Functions (Secrets)

Vai su Supabase Dashboard → Settings → Secrets e aggiungi:

| Nome | Valore |
|------|--------|
| `STRIPE_SECRET_KEY` | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` |

## 7. Deploy Edge Functions

Esegui questi comandi da terminale:

```bash
# Installa Supabase CLI se non l'hai già
npm install -g supabase

# Login a Supabase
supabase login

# Deploy delle funzioni
supabase functions deploy stripe-webhook
supabase functions deploy create-checkout-session
supabase functions deploy create-portal-session
```

## 8. Eseguire Migrazione Database

Esegui lo script SQL `sql/setup_stripe_subscriptions.sql` sulla tua istanza Supabase:

1. Vai su Supabase Dashboard → SQL Editor
2. Copia e incolla il contenuto del file
3. Clicca **Run**

## 9. Test

Per testare in modalità sviluppo:

1. Usa le chiavi test di Stripe
2. Carta di test: `4242 4242 4242 4242`
3. Data scadenza: qualsiasi data futura
4. CVC: qualsiasi 3 cifre

---

## Checklist Configurazione

- [ ] Prodotto creato su Stripe
- [ ] Prezzo mensile creato (copiato ID)
- [ ] Prezzo annuale creato (copiato ID)
- [ ] Webhook configurato
- [ ] Customer Portal configurato
- [ ] Variabili `.env` configurate
- [ ] Secrets Supabase configurati
- [ ] Edge Functions deployate
- [ ] Migrazione database eseguita
- [ ] Test completato
