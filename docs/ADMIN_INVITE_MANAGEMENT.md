# Gestione token invito (shop_invites)

## Creare un token
Esegui sul DB (Supabase SQL):
```sql
insert into public.shop_invites (token, created_by)
values ('SHOP2025-ABC123XYZ', 'admin@abruzzo.ai');
```
- `token`: stringa univoca, difficile da indovinare.
- `expires_at`: opzionale, imposta una scadenza.

## Link da inviare al negozio
- `https://poltrona.abruzzo.ai/setup?token=SHOP2025-ABC123XYZ`

## Cosa fa il wizard
- Valida il token (`shop_invites`) → crea lo shop con slug → marca il token come usato (`used_at`, `used_by_shop_id`).

## Note di sicurezza
- Le policy permettono SELECT a tutti (per validare il token) e UPDATE per marcare `used_at` (il token è l’elemento segreto).
- Usa token lunghi e casuali; imposta `expires_at` se possibile.








