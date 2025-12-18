-- Fix RLS policies for shop_daily_hours and shop_daily_time_slots
-- Il problema era che auth.role() potrebbe non funzionare correttamente
-- Usiamo auth.uid() IS NOT NULL che è più affidabile per verificare l'autenticazione

-- Fix policy per shop_daily_hours
drop policy if exists shop_daily_hours_modify on public.shop_daily_hours;
create policy shop_daily_hours_modify
on public.shop_daily_hours
for all
using (auth.uid() IS NOT NULL)
with check (auth.uid() IS NOT NULL);

-- Fix policy per shop_daily_time_slots
drop policy if exists shop_daily_time_slots_modify on public.shop_daily_time_slots;
create policy shop_daily_time_slots_modify
on public.shop_daily_time_slots
for all
using (auth.uid() IS NOT NULL)
with check (auth.uid() IS NOT NULL);




