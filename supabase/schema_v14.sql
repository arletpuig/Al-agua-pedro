-- AL AGUA PEDRO · versión 14 del esquema (ejecutar DESPUÉS de schema_v13.sql; o ejecuta schema_todo.sql, que lo incluye todo).
-- Ruleta legendaria y ruletas en la tienda (igual que WHEELS en js/levels.js):
--  · Los niveles 10, 20, 30, 40 y 50 traen la RULETA LEGENDARIA (premios mucho mayores) en vez de la normal.
--  · Tienda: la ruleta normal se compra con pesetas (40 + 3 por nivel) y la legendaria con dinero real (pack «ruleta», 0,99 €).
--  · Las tiradas legendarias compradas las entrega SOLO el aviso de Stripe (grant_pack) y se gastan de una en una.
-- Conserva todos los jugadores y su progreso. Se puede ejecutar más de una vez.

alter table public.profiles add column if not exists legend_spins integer not null default 0 check (legend_spins >= 0);

-- Tirada: elige casilla y calcula el premio (sin guardar nada). p_kind = 'normal' o 'legend'; p_level = nivel para las cantidades.
create or replace function public.fn_wheel_roll(p_kind text, p_level integer, p_cards jsonb) returns jsonb language plpgsql volatile as $$
declare
  ids text[]; weights integer[]; r numeric; acc integer := 0; idx integer := 0; seg text; L integer := greatest(1, p_level); i integer;
  pes integer := 0; tom integer := 0; won jsonb := '[]'::jsonb; cards jsonb := p_cards; chest text := null; times integer := 1; mins integer := 0; roll jsonb;
begin
  if p_kind = 'legend' then
    ids := array['l_pes', 'l_tom', 'l_dia', 'l_x5', 'l_top', 'l_pesx', 'l_tomx', 'l_bote']; weights := array[22, 20, 14, 12, 10, 10, 8, 4];
  else
    ids := array['pes_s', 'tom_s', 'card', 'x5', 'pes_m', 'tom_l', 'cards3', 'jackpot']; weights := array[22, 20, 14, 10, 12, 10, 8, 4];
  end if;
  r := random() * 100;
  for i in 1 .. 8 loop acc := acc + weights[i]; if r < acc then idx := i; exit; end if; end loop;
  if idx = 0 then idx := 8; end if;
  seg := ids[idx];
  case seg
    when 'pes_s' then pes := 10 + 2 * L;      when 'tom_s' then tom := 10 + 3 * L;
    when 'pes_m' then pes := 30 + 5 * L;      when 'tom_l' then tom := 30 + 8 * L;
    when 'jackpot' then pes := 100 + 20 * L;  when 'x5' then mins := 10;
    when 'card' then chest := 'wood';         when 'cards3' then chest := 'diamond';
    when 'l_pes' then pes := 300 + 10 * L;    when 'l_tom' then tom := 250 + 10 * L;
    when 'l_pesx' then pes := 800 + 20 * L;   when 'l_tomx' then tom := 800 + 20 * L;
    when 'l_bote' then pes := 2500 + 50 * L;  when 'l_x5' then mins := 30;
    when 'l_dia' then chest := 'diamond'; times := 2;
    when 'l_top' then chest := 'premium';
  end case;
  if chest is not null then
    for i in 1 .. times loop
      roll := public.fn_roll_chest(chest, cards);
      cards := roll->'cards'; won := won || (roll->'reward'->'cards');
      pes := pes + coalesce((roll->'reward'->>'pesetas')::integer, 0); tom := tom + coalesce((roll->'reward'->>'tomatoes')::integer, 0);
    end loop;
  end if;
  return jsonb_build_object('seg', idx - 1, 'id', seg, 'chest', chest, 'pesetas', pes, 'tomatoes', tom, 'won', won, 'cards', cards, 'minutes', mins);
end $$;
revoke all on function public.fn_wheel_roll(text, integer, jsonb) from public, anon, authenticated;

-- Aplica una tirada al jugador (ya bloqueado con FOR UPDATE por quien llama). Devuelve lo que necesita el juego.
create or replace function public.fn_wheel_grant(p_user uuid, p_kind text, p_level integer, p_cost integer, p_wheel_level integer, p_legend_used integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cur public.profiles; row_out public.profiles; roll jsonb; fal timestamptz; mins integer; lvl integer;
begin
  select * into cur from public.profiles where user_id = p_user;
  roll := public.fn_wheel_roll(p_kind, p_level, cur.cards);
  mins := (roll->>'minutes')::integer; fal := cur.falcon_until;
  if mins > 0 then fal := greatest(now(), coalesce(cur.falcon_until, now())) + make_interval(mins => mins); end if;   -- si ya iba el Falcón, se alarga
  update public.profiles set cards = roll->'cards',
    chest_pesetas = chest_pesetas + (roll->>'pesetas')::integer, chest_tomatoes = chest_tomatoes + (roll->>'tomatoes')::integer,
    pesetas_spent = pesetas_spent + p_cost, falcon_until = fal, wheel_level = coalesce(p_wheel_level, wheel_level),
    legend_spins = legend_spins - p_legend_used, updated_at = now()
  where user_id = p_user returning * into row_out;
  lvl := public.fn_player_level(row_out.tomatoes_thrown, row_out.hits, row_out.falls);
  return jsonb_build_object('seg', (roll->>'seg')::integer, 'wheel', p_kind, 'level', lvl, 'pending', greatest(0, lvl - row_out.wheel_level), 'cost', p_cost,
    'reward', jsonb_build_object('kind', coalesce(roll->>'chest', 'wheel'), 'id', roll->>'id', 'wheel', p_kind, 'level', p_level,
      'pesetas', (roll->>'pesetas')::integer, 'tomatoes', (roll->>'tomatoes')::integer, 'cards', roll->'won', 'falcon', mins > 0, 'minutes', mins, 'falcon_until', fal),
    'profile', to_jsonb(row_out));
end $$;
revoke all on function public.fn_wheel_grant(uuid, text, integer, integer, integer, integer) from public, anon, authenticated;

-- 1. Tirada por subir de nivel (los niveles múltiplos de 10, legendaria)
create or replace function public.spin_level_wheel() returns jsonb
language plpgsql security definer set search_path = public as $$
declare cur public.profiles; lvl integer; L integer;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  select * into cur from public.profiles where user_id = auth.uid() for update;
  if not found then raise exception 'El perfil no existe'; end if;
  lvl := public.fn_player_level(cur.tomatoes_thrown, cur.hits, cur.falls);
  if cur.wheel_level >= lvl then raise exception 'No tienes tiradas de ruleta pendientes'; end if;
  L := cur.wheel_level + 1;
  return public.fn_wheel_grant(auth.uid(), case when L % 10 = 0 then 'legend' else 'normal' end, L, 0, L, 0);
end $$;

-- 2. Ruleta de la tienda, pagando pesetas: 40 + 3 por nivel (siempre más de lo que da de media)
create or replace function public.buy_wheel_spin() returns jsonb
language plpgsql security definer set search_path = public as $$
declare cur public.profiles; lvl integer; cost integer;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  select * into cur from public.profiles where user_id = auth.uid() for update;
  if not found then raise exception 'El perfil no existe'; end if;
  lvl := public.fn_player_level(cur.tomatoes_thrown, cur.hits, cur.falls);
  cost := 40 + 3 * lvl;
  if cur.pesetas < cost then raise exception 'No tienes pesetas suficientes'; end if;
  return public.fn_wheel_grant(auth.uid(), 'normal', lvl, cost, null, 0);
end $$;

-- 3. Tirada legendaria comprada (con dinero real)
create or replace function public.spin_legend_wheel() returns jsonb
language plpgsql security definer set search_path = public as $$
declare cur public.profiles; lvl integer;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  select * into cur from public.profiles where user_id = auth.uid() for update;
  if not found then raise exception 'El perfil no existe'; end if;
  if cur.legend_spins < 1 then raise exception 'No tienes tiradas legendarias'; end if;
  lvl := public.fn_player_level(cur.tomatoes_thrown, cur.hits, cur.falls);
  return public.fn_wheel_grant(auth.uid(), 'legend', lvl, 0, null, 1);
end $$;
revoke all on function public.spin_level_wheel(), public.buy_wheel_spin(), public.spin_legend_wheel() from public, anon;
grant execute on function public.spin_level_wheel(), public.buy_wheel_spin(), public.spin_legend_wheel() to authenticated;

-- 4. Pagos: el pack «ruleta» (0,99 €) da una tirada legendaria. Lo entrega SOLO el aviso de Stripe.
create or replace function public.fn_pack(p text) returns jsonb language sql immutable as $$
  select case p
    when 'calderilla' then '{"pesetas": 750, "tomatoes": 300, "cards": 0}'::jsonb
    when 'maletin'    then '{"pesetas": 1750, "tomatoes": 700, "cards": 0}'::jsonb
    when 'camara'     then '{"pesetas": 5000, "tomatoes": 2000, "cards": 4}'::jsonb
    when 'ruleta'     then '{"pesetas": 0, "tomatoes": 0, "cards": 0, "spins": 1}'::jsonb
  end $$;
create or replace function public.grant_pack(p_session text, p_user uuid, p_pack text, p_amount integer, p_currency text) returns boolean
language plpgsql security definer set search_path = public as $$
declare g jsonb := public.fn_pack(p_pack); n integer; cur public.profiles; roll jsonb; extra integer := 0; won jsonb := '[]'::jsonb; spins integer;
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
  spins := coalesce((g->>'spins')::integer, 0);
  update public.purchases set reward = jsonb_build_object('cards', won, 'pesetas', (g->>'pesetas')::integer + extra, 'tomatoes', (g->>'tomatoes')::integer, 'spins', spins)
    where stripe_session = p_session;
  update public.profiles set cards = cur.cards, chest_pesetas = chest_pesetas + (g->>'pesetas')::integer + extra, chest_tomatoes = chest_tomatoes + (g->>'tomatoes')::integer,
    legend_spins = legend_spins + spins, updated_at = now() where user_id = p_user;
  return true;
end $$;
revoke all on function public.grant_pack(text, uuid, text, integer, text) from public, anon, authenticated;
grant execute on function public.grant_pack(text, uuid, text, integer, text) to service_role;
