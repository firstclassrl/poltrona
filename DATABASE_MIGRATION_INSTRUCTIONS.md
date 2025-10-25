# Istruzioni per la Migration del Database

## Problema
L'errore "Failed to update shop" si verifica perché il campo `products_enabled` non esiste ancora nella tabella `shops` del database.

## Soluzione
Eseguire la migration SQL per aggiungere il campo `products_enabled` alla tabella `shops`.

### Passi da seguire:

1. **Accedere al database Supabase**:
   - Vai su https://supabase.com
   - Accedi al tuo progetto
   - Vai su "SQL Editor"

2. **Eseguire la migration**:
   - Copia e incolla il contenuto del file `sql/add_products_enabled_field.sql`
   - Clicca "Run" per eseguire la query

3. **Verificare la migration**:
   - La query dovrebbe restituire informazioni sul campo aggiunto
   - Verifica che non ci siano errori

### Contenuto della Migration:
```sql
-- Aggiunge il campo products_enabled alla tabella shops
ALTER TABLE public.shops 
ADD COLUMN IF NOT EXISTS products_enabled BOOLEAN DEFAULT true;

-- Aggiungi un commento per documentare il campo
COMMENT ON COLUMN public.shops.products_enabled IS 'Controlla se il sistema prodotti e upsell è abilitato per questo negozio';
```

### Dopo la Migration:
- Il toggle "Sistema Prodotti" funzionerà correttamente
- Le impostazioni avanzate potranno essere salvate senza errori
- Il campo avrà valore di default `true` (prodotti abilitati)

## Note:
- La migration è sicura e non modifica dati esistenti
- Il campo viene aggiunto solo se non esiste già
- Tutti i negozi esistenti avranno i prodotti abilitati di default
