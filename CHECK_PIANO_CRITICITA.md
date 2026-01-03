# Check Generale Piano - Criticità Trovate

## ✅ VERIFICHE COMPLETATE

### 1. Database Schema vs Codice
- ✅ Database ha `price` (numeric) - Products.tsx usa `price` - CORRETTO
- ✅ Database ha `imageurl` - Products.tsx usa `imageurl` - CORRETTO
- ✅ Database ha `instock` - Products.tsx usa `instock` - CORRETTO
- ✅ Database ha `stockquantity` - Products.tsx usa `stockquantity` - CORRETTO
- ✅ Database ha `shop_id` - Products.tsx lo gestisce - CORRETTO

### 2. Mapping Fields
- ✅ `convertDatabaseToUI`: mappa correttamente `imageurl` → `imageUrl`
- ✅ `convertUIToDatabase`: mappa correttamente `imageUrl` → `imageurl`
- ✅ Il mapping è coerente con il database reale

## ⚠️ CRITICITÀ TROVATE NEL PIANO

### 1. **Campo image_url nel piano vs imageurl nel database**

**Problema**: 
- Il piano menziona `image_url` ma il database reale ha `imageurl` (senza underscore)
- Products.tsx usa correttamente `imageurl` nel mapping
- Ma il piano potrebbe confondere

**Risoluzione**: 
- Il codice è già corretto
- Il piano usa `image_url` in alcune sezioni ma il codice reale usa `imageurl`
- **AZIONE**: Verificare che il piano sia chiaro che useremo `imageurl` come nel database

### 2. **uploadProductPhotoPublic - Path struttura**

**Piano dice**: `shops/{shopId}/products/{productId}/image.{ext}`

**Verifica pattern esistenti**:
- `uploadStaffPhotoPublic`: `staff/{staffId}/profile.{ext}` (non organizza per shop)
- `uploadShopLogoPublic`: `shops/{shopId}/logo.{ext}` (organizza per shop)
- `uploadClientPhotoPublic`: `clients/{userId}/profile.{ext}` (non organizza per shop)

**Domanda**: I prodotti devono essere organizzati per shop nel path storage?
- Pro: Organizzazione chiara, isolamento per shop
- Contro: Pattern staff/client non lo fa

**Raccomandazione**: Seguire il pattern richiesto dall'utente (`shops/{shopId}/products/{productId}/image.{ext}`)

### 3. **Gestione shop_id per upload**

**Piano dice**: Ottenere shopId usando `getStoredShopId()` o `apiService.getShop()`

**Verifica codice esistente**:
- `createProduct` già gestisce shop_id automaticamente (linea 3248)
- Per upload, possiamo usare la stessa logica
- Per prodotti esistenti, il prodotto restituito da `getProducts()` potrebbe avere `shop_id`

**Verifica necessaria**: I prodotti restituiti da `getProducts()` includono `shop_id`?

**Raccomandazione**: 
- Per nuovi prodotti: usare `getStoredShopId()` o `apiService.getShop()` (stessa logica di createProduct)
- Per prodotti esistenti: usare `editingProduct.shop_id` se disponibile, altrimenti fallback a `getStoredShopId()`

### 4. **resetModalState - Pattern esistente**

**Cerca pattern**: Esiste già `resetNewMessageModal` in Chat.tsx che resetta multiple state

**Pattern trovato**: Sì, esiste pattern simile
- Chat.tsx linea 169: `resetNewMessageModal` che resetta multiple state

**Raccomandazione**: Seguire pattern simile per `resetModalState`

### 5. **Image URL storage - Campo nel database**

**Domanda**: Il campo `imageurl` nel database conterrà:
- A) L'URL pubblico completo (es. `https://.../storage/v1/object/public/product-photos/...`)
- B) Solo il path relativo (es. `shops/{shopId}/products/{productId}/image.jpg`)

**Verifica pattern esistenti**:
- `uploadStaffPhotoPublic`: restituisce `{ path, publicUrl }` - il `path` è relativo, `publicUrl` è completo
- `BarberProfile.tsx`: salva `publicUrl` nel database
- `Shop.tsx`: salva `logo_url` (URL completo) e `logo_path` (path relativo)

**Raccomandazione**: Salvare `publicUrl` (URL completo) nel campo `imageurl` per coerenza con altri componenti

### 6. **Pre-caricamento immagine in edit mode**

**Piano dice**: Pre-caricare immagine esistente quando `editingProduct` è presente

**Verifica codice**:
- `handleEditProduct` (linea 175) pre-carica `addImageUrl` con `product.imageUrl`
- `PhotoUpload` component accetta `currentImageUrl` prop
- **OK**: Il pattern esiste e funziona

### 7. **Cleanup immagine quando si elimina prodotto**

**Piano dice**: Opzionale ma consigliato

**Verifica pattern esistenti**:
- Non ho trovato cleanup automatico di immagini quando si elimina staff/client
- Le immagini vengono lasciate nello storage

**Raccomandazione**: 
- Opzionale per ora (come detto nel piano)
- Può essere aggiunto in futuro se necessario
- Non critico per questa implementazione

### 8. **Error handling - Pattern esistente**

**Verifica**: Come vengono gestiti gli errori in altri upload?

**Pattern trovato**:
- `BarberProfile.tsx`: usa try-catch e mostra errori
- Pattern comune: try-catch + `showToast` per errori

**Raccomandazione**: Seguire pattern esistente (già menzionato nel piano)

## ✅ COERENZA GENERALE

### Codice vs Database
- ✅ Products.tsx è coerente con database reale
- ✅ Mapping fields corretto
- ✅ Nomi colonne corrispondono

### Pattern Esistenti
- ✅ PhotoUpload component già esiste e funziona
- ✅ Upload functions seguono pattern simile
- ✅ DeleteConfirmation component già esiste
- ✅ Toast system già implementato

### Shop ID Management
- ✅ `createProduct` già gestisce shop_id automaticamente
- ✅ Stessa logica può essere usata per upload

## 📋 CHECKLIST FINALE

- [x] Database schema verificato (price, imageurl, etc.)
- [x] Mapping fields verificato (corretto)
- [x] Pattern upload esistenti verificati
- [x] Pattern reset state verificati
- [x] Pattern error handling verificati
- [x] Shop ID management verificato
- [x] PhotoUpload component verificato
- [x] DeleteConfirmation component verificato

## 🎯 CONCLUSIONE

**Nessuna criticità bloccante trovata**. Il piano è solido e coerente con:
- Database reale
- Pattern di codice esistenti
- Best practices del progetto

**Raccomandazioni minori**:
1. Salvare `publicUrl` completo nel campo `imageurl` (come altri componenti)
2. Verificare che prodotti da `getProducts()` includano `shop_id` (probabilmente sì)
3. Cleanup immagini opzionale (come già nel piano)

Il piano è pronto per l'implementazione.
