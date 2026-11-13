-- AL AGUA PEDRO · versión 11 del esquema (ejecutar DESPUÉS de schema_v10.sql; o ejecuta schema_todo.sql, que lo incluye todo).
-- Packs de pesetas con pago real (Stripe Checkout).
--  · Las pesetas SOLO las entrega el webhook de Stripe (función supabase/functions/stripe-webhook), con la clave de servicio.
--  · Cada pago (sesión de Stripe) se entrega una sola vez aunque Stripe repita el aviso.
--  · El jugador puede ver sus propias compras (para que el juego sepa cuándo han llegado).
-- Conserva todos los jugadores y su progreso. Se puede ejecutar más de una vez.

create table if not exists public.purchases (
  stripe_session text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  pack text not null,
  pesetas integer not null check (pesetas >= 0),
  tomatoes integer not null check (tomatoes >= 0),
  amount_cents integer,
  currency text,
  created_at timestamptz not null default now()
);
create index if not exists purchases_user_idx on public.purchases (user_id, created_at desc);
alter table public.purchases enable row level security;
drop policy if exists "ver mis compras" on public.purchases;
create policy "ver mis compras" on public.purchases for select to authenticated using (auth.uid() = user_id);
revoke insert, update, delete on public.purchases from anon, authenticated;
grant select on public.purchases to authenticated;

-- Contenido de cada pack (igual que PACKS en js/economy.js). El precio lo fija Stripe, no el juego.
create or replace function public.fn_pack(p text) returns jsonb language sql immutable as $$
  select case p
    when 'calderilla' then '{"pesetas": 150, "tomatoes": 60}'::jsonb
    when 'maletin'    then '{"pesetas": 550, "tomatoes": 220}'::jsonb
    when 'camara'     then '{"pesetas": 2200, "tomatoes": 900}'::jsonb
  end $$;

-- La llama SOLO el webhook de Stripe (rol service_role). Devuelve true si ha entregado, false si ese pago ya estaba entregado.
create or replace function public.grant_pack(p_session text, p_user uuid, p_pack text, p_amount integer, p_currency text) returns boolean
language plpgsql security definer set search_path = public as $$
declare g jsonb := public.fn_pack(p_pack); n integer;
begin
  if g is null then raise exception 'Pack desconocido: %', p_pack; end if;
  if not exists (select 1 from public.profiles where user_id = p_user) then raise exception 'Jugador desconocido'; end if;
  insert into public.purchases (stripe_session, user_id, pack, pesetas, tomatoes, amount_cents, currency)
  values (p_session, p_user, p_pack, (g->>'pesetas')::integer, (g->>'tomatoes')::integer, p_amount, p_currency)
  on conflict (stripe_session) do nothing;
  get diagnostics n = row_count;
  if n = 0 then return false; end if;           -- aviso repetido: ya se entregó
  update public.profiles set chest_pesetas = chest_pesetas + (g->>'pesetas')::integer, chest_tomatoes = chest_tomatoes + (g->>'tomatoes')::integer,
    updated_at = now() where user_id = p_user;
  return true;
end $$;
revoke all on function public.grant_pack(text, uuid, text, integer, text) from public, anon, authenticated;
grant execute on function public.grant_pack(text, uuid, text, integer, text) to service_role;
