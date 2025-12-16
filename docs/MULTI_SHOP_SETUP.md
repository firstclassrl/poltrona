# Setup multi-negozio (Supabase shared DB)

## Flussi
- **Onboarding negozio**: `poltrona.abruzzo.ai/setup?token=XYZ` → `ShopSetup` valida il token (`shop_invites`), crea lo shop (slug richiesto), marca il token usato.
- **Registrazione clienti**: link/QR `poltrona.abruzzo.ai?shop=<slug>` → durante registrazione il profilo/cliente viene associato allo shop.
- **Compatibilità QR esistenti**: se l’utente anonimo apre senza `?shop=`, fallback allo shop di default `retro-barbershop` (QR già stampati restano validi).
- **Login**: dopo login usiamo `shop_id` del profilo; il provider `ShopContext` carica i dati negozio e li propaga all’app.

## Passi per creare un nuovo negozio
1. Genera token invito (vedi `ADMIN_INVITE_MANAGEMENT.md` oppure inserisci una riga in `shop_invites`).
2. Invia al negozio il link: `https://poltrona.abruzzo.ai/setup?token=...`.
3. Il negozio compila il form: slug, dati base, email/notifiche.
4. Al termine viene mostrato il link clienti: `https://poltrona.abruzzo.ai/?shop=<slug>` da usare per QR.

## Tabelle/Script
- `sql/add_shop_slug.sql`: aggiunge slug univoco a `shops`.
- `sql/create_shop_invites_table.sql`: tabella token invito + RLS.
- `sql/update_rls_for_multi_shop.sql`: RLS filtrate su `shop_id` e helper `current_shop_id()`.
- `sql/migrate_existing_shop.sql`: assegna slug default `retro-barbershop` e compila gli `shop_id` mancanti.

## Note operative
- Mantieni indici su `shop_id` e `slug`.
- `ShopContext` legge `shop_id` (profilo) o `?shop=` e fornisce `currentShop` a tutta l’app.
- Il QR componente (`ShopQRCode`) usa un endpoint pubblico per generare l’immagine senza dipendenze extra.





