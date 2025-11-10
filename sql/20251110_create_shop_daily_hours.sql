-- Create table to store daily shop hours (one row per day)
create table if not exists public.shop_daily_hours (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  is_open boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_shop_daily_hours_unique
on public.shop_daily_hours (shop_id, day_of_week);

create trigger trg_shop_daily_hours_set_updated_at
before update on public.shop_daily_hours
for each row execute function public.set_updated_at();

-- Table for individual time slots (multiple ranges per day)
create table if not exists public.shop_daily_time_slots (
  id uuid primary key default gen_random_uuid(),
  daily_hours_id uuid not null references public.shop_daily_hours(id) on delete cascade,
  start_time time not null,
  end_time time not null,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_shop_time_slot_range check (end_time > start_time)
);

create index if not exists idx_shop_daily_time_slots_daily_hours
on public.shop_daily_time_slots (daily_hours_id);

create trigger trg_shop_daily_time_slots_set_updated_at
before update on public.shop_daily_time_slots
for each row execute function public.set_updated_at();

-- Enable RLS and define policies
alter table public.shop_daily_hours enable row level security;
alter table public.shop_daily_time_slots enable row level security;

drop policy if exists shop_daily_hours_select on public.shop_daily_hours;
create policy shop_daily_hours_select
on public.shop_daily_hours
for select
using (true);

drop policy if exists shop_daily_time_slots_select on public.shop_daily_time_slots;
create policy shop_daily_time_slots_select
on public.shop_daily_time_slots
for select
using (true);

drop policy if exists shop_daily_hours_modify on public.shop_daily_hours;
create policy shop_daily_hours_modify
on public.shop_daily_hours
for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists shop_daily_time_slots_modify on public.shop_daily_time_slots;
create policy shop_daily_time_slots_modify
on public.shop_daily_time_slots
for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

-- Optional: migrate legacy JSON from shops.opening_hours into the new structure
do $$
declare
  legacy_has_rows boolean;
begin
  select exists(
    select 1 from public.shops
    where opening_hours is not null
      and opening_hours <> ''
  ) into legacy_has_rows;

  if legacy_has_rows then
    with legacy as (
      select id as shop_id, opening_hours::jsonb as config
      from public.shops
      where opening_hours is not null
        and opening_hours <> ''
    )
    insert into public.shop_daily_hours (shop_id, day_of_week, is_open)
    select
      l.shop_id,
      (day_entry.key)::int as day_of_week,
      coalesce((day_entry.value->>'isOpen')::boolean, false) as is_open
    from legacy l
    cross join jsonb_each(l.config->'shopHours') as day_entry
    on conflict (shop_id, day_of_week) do update
    set is_open = excluded.is_open;

    with legacy_slots as (
      select
        l.shop_id,
        (day_entry.key)::int as day_of_week,
        slot.value as slot_value,
        slot.ordinality - 1 as slot_position
      from legacy l
      cross join jsonb_each(l.config->'shopHours') as day_entry
      cross join lateral jsonb_array_elements(day_entry.value->'timeSlots') with ordinality as slot(value, ordinality)
    )
    insert into public.shop_daily_time_slots (daily_hours_id, start_time, end_time, position)
    select
      h.id,
      (slot_value->>'start')::time,
      (slot_value->>'end')::time,
      slot_position
    from legacy_slots ls
    join public.shop_daily_hours h
      on h.shop_id = ls.shop_id
     and h.day_of_week = ls.day_of_week
    on conflict do nothing;
  end if;
end $$;

-- Reset legacy column once migrated (optional, comment if you prefer to keep it)
-- update public.shops set opening_hours = null where opening_hours is not null;

