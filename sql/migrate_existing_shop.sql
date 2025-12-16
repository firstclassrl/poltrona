-- Migrazione per assegnare slug e shop_id al negozio esistente (fallback retro-compatibile)
DO $$
DECLARE
  default_slug text := 'retro-barbershop';
  default_shop_id uuid;
BEGIN
  -- Prendi il primo shop esistente come default
  SELECT id INTO default_shop_id
  FROM public.shops
  ORDER BY created_at ASC
  LIMIT 1;

  IF default_shop_id IS NULL THEN
    RAISE NOTICE 'Nessun shop presente, nulla da migrare.';
    RETURN;
  END IF;

  -- Se lo slug è assente, assegna quello di default (o lascia quello esistente)
  UPDATE public.shops
  SET slug = default_slug
  WHERE id = default_shop_id
    AND (slug IS NULL OR slug = '' OR slug = CONCAT('shop-', id::text));

  -- Assicura unicità: se esiste già quello slug su altro shop, non sovrascrivere
  -- (in caso di conflitto manuale, sistemare a mano)

  -- Assegna shop_id mancante a profili, clienti, staff, appuntamenti, servizi, prodotti, waitlist
  UPDATE public.profiles SET shop_id = default_shop_id WHERE shop_id IS NULL;
  UPDATE public.clients SET shop_id = default_shop_id WHERE shop_id IS NULL;
  UPDATE public.staff SET shop_id = default_shop_id WHERE shop_id IS NULL;
  UPDATE public.appointments SET shop_id = default_shop_id WHERE shop_id IS NULL;
  UPDATE public.services SET shop_id = default_shop_id WHERE shop_id IS NULL;
  UPDATE public.products SET shop_id = default_shop_id WHERE shop_id IS NULL;
  UPDATE public.waitlist SET shop_id = default_shop_id WHERE shop_id IS NULL;
  UPDATE public.shop_daily_hours SET shop_id = default_shop_id WHERE shop_id IS NULL;

  RAISE NOTICE 'Migrazione completata per shop % con slug %', default_shop_id, default_slug;
END $$;





