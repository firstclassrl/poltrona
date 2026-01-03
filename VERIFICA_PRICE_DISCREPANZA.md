# Verifica Discrepanza Price/Price_cents

## Problema Identificato

C'è una discrepanza tra:
- Database schema: `price_cents INTEGER`
- Tipo TypeScript: `price_cents: number | null` (in `types/index.ts`)
- Interface locale in Products.tsx: `price: number | null`
- Altri componenti (ClientProducts, ProductUpsell): usano `price_cents`

## Come Verificare

### Opzione 1: Controllo Diretto Database
Controllare nel Supabase Dashboard cosa c'è effettivamente nella tabella:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'products' AND table_schema = 'public';
```

### Opzione 2: Log Console
Aggiungere un console.log temporaneo in `getProducts()` per vedere cosa restituisce l'API:
```typescript
const products = await response.json();
console.log('API Response:', products[0]); // Vedere la struttura reale
```

### Opzione 3: Test Pratico
Creare un prodotto e vedere:
1. Cosa viene salvato nel database
2. Cosa restituisce l'API quando lo legge

## Possibili Scenari

### Scenario A: Database ha price_cents, API lo converte automaticamente
- Supabase/PostgREST potrebbe avere una view o conversion automatica
- Il codice funziona perché l'API fa conversion

### Scenario B: Database ha price_cents ma il codice sbaglia
- Il codice usa `price` ma il database ha `price_cents`
- Potrebbe funzionare per caso o non funzionare affatto

### Scenario C: Database effettivo è diverso dallo schema SQL
- Lo schema SQL potrebbe non essere aggiornato
- Il database reale potrebbe avere `price` invece di `price_cents`

## Raccomandazione

**PRIMA di implementare:**
1. Verificare nel Supabase Dashboard la struttura reale della tabella `products`
2. Fare un test: creare un prodotto e vedere cosa restituisce `getProducts()`
3. Se c'è discrepanza, decidere quale sistema usare:
   - Se database ha `price_cents`: correggere `convertUIToDatabase` e `convertDatabaseToUI` per convertire
   - Se database ha `price`: correggere lo schema SQL e il tipo TypeScript

## Nota Importante

`ClientProducts.tsx` e `ProductUpsell.tsx` usano `price_cents` e lo dividono per 100.
Se il database ha `price_cents`, allora `Products.tsx` è sbagliato e va corretto.
Se il database ha `price`, allora `ClientProducts.tsx` e `ProductUpsell.tsx` sono sbagliati.
