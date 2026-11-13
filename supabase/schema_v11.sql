-- AL AGUA PEDRO · versión 11 del esquema (ejecutar DESPUÉS de schema_v10.sql; o ejecuta schema_todo.sql, que lo incluye todo).
-- Packs de pesetas con pago real (Stripe Checkout).
--  · Las pesetas SOLO las entrega el webhook de Stripe (función supabase/functions/stripe-webhook), con la clave de servicio.
--  · Cada pago (sesión de Stripe) se entrega una sola vez aunque Stripe repita el aviso.
--  · El jugador puede ver sus propias compras (para que el juego sepa cuándo han llegado).
--  · Organización criminal 1,99 € (750 pesetas + 300 tomates), Caso Koldo 2,99 € (1.300 + 520) y
--    Financiación ilegal PSOE 9,95 € (5.000 + 2.000 + 4 cartas épicas o legendarias).
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
alter table public.purchases add column if not exists reward jsonb;
create index if not exists purchases_user_idx on public.purchases (user_id, created_at desc);
alter table public.purchases enable row level security;
drop policy if exists "ver mis compras" on public.purchases;
create policy "ver mis compras" on public.purchases for select to authenticated using (auth.uid() = user_id);
revoke insert, update, delete on public.purchases from anon, authenticated;
grant select on public.purchases to authenticated;

-- Contenido de cada pack (igual que PACKS en js/economy.js). El precio lo fija Stripe, no el juego.
create or replace function public.fn_pack(p text) returns jsonb language sql immutable as $$
  select case p
    when 'calderilla' then '{"pesetas": 750, "tomatoes": 300, "cards": 0}'::jsonb
    when 'maletin'    then '{"pesetas": 1300, "tomatoes": 520, "cards": 0}'::jsonb
    when 'camara'     then '{"pesetas": 5000, "tomatoes": 2000, "cards": 4}'::jsonb
  end $$;

-- Tirada de cartas del pack grande («premium»: solo épicas y legendarias). Es la misma función de los cofres, con un tipo más.
create or replace function public.fn_roll_chest(p_kind text, p_cards jsonb) returns jsonb language plpgsql volatile as $$
declare
  cards jsonb := p_cards;
  w_common numeric; w_rare numeric; w_epic numeric; w_leg numeric; total numeric;
  n_cards integer; t_min integer; t_max integer; p_chance numeric; p_min integer; p_max integer;
  i integer; r numeric; rar text; cid text; pool text[]; is_new boolean; locked boolean; lvl integer; fr integer; need integer; gained integer;
  rewards jsonb := '[]'::jsonb; tomatoes integer; pesetas integer := 0;
begin
  if p_kind = 'wood' then w_common := 55; w_rare := 15; w_epic := 11; w_leg := 4; n_cards := 1; t_min := 2; t_max := 6; p_chance := 0.2; p_min := 1; p_max := 2;
  elsif p_kind = 'premium' then w_common := 0; w_rare := 0; w_epic := 65; w_leg := 35; n_cards := 4; t_min := 0; t_max := 0; p_chance := 0; p_min := 0; p_max := 0;
  elsif p_kind = 'welcome' then w_common := 60; w_rare := 30; w_epic := 10; w_leg := 0; n_cards := 2; t_min := 30; t_max := 40; p_chance := 1; p_min := 50; p_max := 60;
  else w_common := 30; w_rare := 19; w_epic := 22; w_leg := 10; n_cards := 3; t_min := 10; t_max := 25; p_chance := 0.6; p_min := 3; p_max := 8; end if;
  -- las rarezas cuyas cartas están todas al máximo ya no salen
  if not public.fn_rarity_open(cards, 'common') then w_common := 0; end if;
  if not public.fn_rarity_open(cards, 'rare') then w_rare := 0; end if;
  if not public.fn_rarity_open(cards, 'epic') then w_epic := 0; end if;
  if not public.fn_rarity_open(cards, 'legendary') then w_leg := 0; end if;
  total := w_common + w_rare + w_epic + w_leg;
  for i in 1 .. n_cards loop
    if total = 0 then pesetas := pesetas + 3; continue; end if;
    r := random() * total;
    if r < w_common then rar := 'common'; elsif r < w_common + w_rare then rar := 'rare'; elsif r < w_common + w_rare + w_epic then rar := 'epic'; else rar := 'legendary'; end if;
    select array_agg(x) into pool from unnest(public.fn_rarity_cards(rar)) x where public.fn_card_level(cards, x) < public.fn_max_level(x);
    cid := pool[1 + floor(random() * array_length(pool, 1))::integer];
    lvl := public.fn_card_level(cards, cid); fr := public.fn_card_frags(cards, cid); need := public.fn_unlock_need(rar); is_new := false;
    if lvl = 0 then
      fr := fr + 1; gained := 1;
      if fr >= need then lvl := 1; fr := fr - need; is_new := true; end if;
    else fr := fr + public.fn_drop_frags(rar); gained := public.fn_drop_frags(rar); end if;
    locked := lvl = 0;
    cards := jsonb_set(cards, array[cid], jsonb_build_object('level', lvl, 'frags', fr));
    rewards := rewards || jsonb_build_object('id', cid, 'rarity', rar, 'isNew', is_new, 'bonus', false, 'frags', gained, 'locked', locked, 'have', fr, 'need', need);
  end loop;
  tomatoes := t_min + floor(random() * (t_max - t_min + 1))::integer;
  if random() < p_chance then pesetas := pesetas + p_min + floor(random() * (p_max - p_min + 1))::integer; end if;
  return jsonb_build_object('reward', jsonb_build_object('kind', p_kind, 'cards', rewards, 'tomatoes', tomatoes, 'pesetas', pesetas), 'cards', cards);
end $$;
revoke all on function public.fn_roll_chest(text, jsonb) from public, anon, authenticated;

-- La llama SOLO el webhook de Stripe (rol service_role). Devuelve true si ha entregado, false si ese pago ya estaba entregado.
create or replace function public.grant_pack(p_session text, p_user uuid, p_pack text, p_amount integer, p_currency text) returns boolean
language plpgsql security definer set search_path = public as $$
declare g jsonb := public.fn_pack(p_pack); n integer; cur public.profiles; roll jsonb; extra integer := 0; won jsonb := '[]'::jsonb;
begin
  if g is null then raise exception 'Pack desconocido: %', p_pack; end if;
  select * into cur from public.profiles where user_id = p_user for update;
  if not found then raise exception 'Jugador desconocido'; end if;
  insert into public.purchases (stripe_session, user_id, pack, pesetas, tomatoes, amount_cents, currency)
  values (p_session, p_user, p_pack, (g->>'pesetas')::integer, (g->>'tomatoes')::integer, p_amount, p_currency)
  on conflict (stripe_session) do nothing;
  get diagnostics n = row_count;
  if n = 0 then return false; end if;           -- aviso repetido: ya se entregó
  if coalesce((g->>'cards')::integer, 0) > 0 then
    roll := public.fn_roll_chest('premium', cur.cards);
    cur.cards := roll->'cards'; won := roll->'reward'->'cards'; extra := coalesce((roll->'reward'->>'pesetas')::integer, 0);
  end if;
  update public.purchases set reward = jsonb_build_object('cards', won, 'pesetas', (g->>'pesetas')::integer + extra, 'tomatoes', (g->>'tomatoes')::integer)
    where stripe_session = p_session;
  update public.profiles set cards = cur.cards, chest_pesetas = chest_pesetas + (g->>'pesetas')::integer + extra, chest_tomatoes = chest_tomatoes + (g->>'tomatoes')::integer,
    updated_at = now() where user_id = p_user;
  return true;
end $$;
revoke all on function public.grant_pack(text, uuid, text, integer, text) from public, anon, authenticated;
grant execute on function public.grant_pack(text, uuid, text, integer, text) to service_role;
