-- AL AGUA PEDRO · ACTUALIZACIÓN COMPLETA (todo en uno)
-- Lleva la base de datos a la última versión desde CUALQUIER versión anterior (incluso desde cero).
-- Es lo mismo que ejecutar schema.sql y schema_v2.sql, schema_v3.sql... seguidos.
-- Conserva todos los jugadores y su progreso. Se puede ejecutar más de una vez.
-- Va todo en una transacción: si algo fallara, no se cambia nada.
begin;
-- la vista del ranking se rehace más abajo (así el esquema base se puede volver a ejecutar sobre una base ya actualizada)
drop view if exists public.leaderboard;


-- ===================================================================== schema.sql
-- AL AGUA PEDRO · esquema de base de datos para Supabase.
-- Pega este archivo completo en: Supabase > SQL Editor > New query > Run.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null default 'Jugador',
  total_clicks bigint not null default 0 check (total_clicks >= 0),
  tomatoes_thrown integer not null default 0 check (tomatoes_thrown >= 0),
  hits integer not null default 0 check (hits >= 0),
  falls integer not null default 0 check (falls >= 0),
  -- valores derivados (100 clics = 1 tomate; debe coincidir con CLICKS_PER_TOMATO en js/config.js)
  tomatoes_earned integer generated always as ((total_clicks / 100)::integer) stored,
  clicks_progress integer generated always as ((total_clicks % 100)::integer) stored,
  tomatoes integer generated always as ((total_clicks / 100)::integer - tomatoes_thrown) stored,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Cada usuario solo puede leer su propia fila. Las escrituras pasan SIEMPRE por save_progress().
drop policy if exists "leer propio perfil" on public.profiles;
create policy "leer propio perfil" on public.profiles for select to authenticated using (auth.uid() = user_id);
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

-- Crea el perfil automáticamente al registrarse.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, username)
  values (new.id, coalesce(left(nullif(trim(new.raw_user_meta_data->>'username'), ''), 20), 'Jugador'))
  on conflict (user_id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Guardado validado en el servidor: no confía en el navegador.
create or replace function public.save_progress(p_total_clicks bigint, p_tomatoes_thrown integer, p_hits integer, p_falls integer)
returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  cur public.profiles; new_row public.profiles;
  secs numeric; max_clicks bigint; v_clicks bigint; v_thrown integer; v_hits integer; v_falls integer;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select * into cur from public.profiles where user_id = auth.uid() for update;
  if not found then
    insert into public.profiles (user_id) values (auth.uid()) returning * into cur;
  end if;
  -- los totales nunca bajan
  v_clicks := greatest(cur.total_clicks, coalesce(p_total_clicks, 0));
  -- límite contra automatizaciones: máx. 25 clics/segundo desde el último guardado (+600 de margen)
  secs := extract(epoch from (now() - cur.updated_at));
  max_clicks := cur.total_clicks + 600 + floor(secs * 25)::bigint;
  v_clicks := least(v_clicks, max_clicks);
  -- no se pueden lanzar más tomates de los conseguidos
  v_thrown := least(greatest(cur.tomatoes_thrown, coalesce(p_tomatoes_thrown, 0)), (v_clicks / 100)::integer);
  v_hits := least(greatest(cur.hits, coalesce(p_hits, 0)), v_thrown);
  v_falls := least(greatest(cur.falls, coalesce(p_falls, 0)), v_hits);
  update public.profiles set total_clicks = v_clicks, tomatoes_thrown = v_thrown, hits = v_hits, falls = v_falls, updated_at = now()
  where user_id = auth.uid() returning * into new_row;
  return new_row;
end $$;
grant execute on function public.save_progress(bigint, integer, integer, integer) to authenticated;
revoke execute on function public.save_progress(bigint, integer, integer, integer) from anon;

-- Ranking público (solo nombre y estadísticas, nunca correos).
create or replace view public.leaderboard with (security_invoker = false) as
  select username, falls, hits, tomatoes_thrown, total_clicks
  from public.profiles where falls > 0 or hits > 0
  order by falls desc, hits desc limit 50;
grant select on public.leaderboard to anon, authenticated;

-- ===================================================================== schema_v2.sql
-- AL AGUA PEDRO · versión 2: pesetas, cofres, cartas, cofre diario, ranking por tomates históricos.
-- Pega este archivo completo en: Supabase > SQL Editor > New query > Run. (Requiere haber ejecutado antes schema.sql)

-- 1. Nuevas columnas -------------------------------------------------------------------------
drop view if exists public.leaderboard;
alter table public.profiles
  add column if not exists perfects integer not null default 0 check (perfects >= 0),
  add column if not exists pesetas_earned integer not null default 0 check (pesetas_earned >= 0),
  add column if not exists chest_tomatoes integer not null default 0 check (chest_tomatoes >= 0),
  add column if not exists chest_pesetas integer not null default 0 check (chest_pesetas >= 0),
  add column if not exists pesetas_spent integer not null default 0 check (pesetas_spent >= 0),
  add column if not exists chests_opened integer not null default 0,
  add column if not exists cards jsonb not null default '{"inflacion":{"level":0,"frags":0},"joyas":{"level":0,"frags":0},"mariscada":{"level":0,"frags":0},"apagon":{"level":0,"frags":0},"amnistia":{"level":0,"frags":0}}'::jsonb,
  add column if not exists daily_claimed_on date,
  add column if not exists falcon_until timestamptz,
  add column if not exists created_at timestamptz not null default now();
alter table public.profiles drop column if exists tomatoes_earned, drop column if exists clicks_progress, drop column if exists tomatoes, drop column if exists pesetas;
alter table public.profiles
  add column tomatoes_earned integer generated always as ((total_clicks / 100)::integer + chest_tomatoes) stored,
  add column clicks_progress integer generated always as ((total_clicks % 100)::integer) stored,
  add column tomatoes integer generated always as ((total_clicks / 100)::integer + chest_tomatoes - tomatoes_thrown) stored,
  add column pesetas integer generated always as (pesetas_earned + chest_pesetas - pesetas_spent) stored;

-- 2. Reglas de economía (idénticas a js/economy.js) -------------------------------------------
create or replace function public.fn_card_level(p_cards jsonb, p_id text) returns integer language sql immutable as $$
  select coalesce((p_cards->p_id->>'level')::integer, 0) $$;
create or replace function public.fn_card_frags(p_cards jsonb, p_id text) returns integer language sql immutable as $$
  select coalesce((p_cards->p_id->>'frags')::integer, 0) $$;
create or replace function public.fn_rarity(p_id text) returns text language sql immutable as $$
  select case p_id when 'inflacion' then 'common' when 'joyas' then 'rare' when 'apagon' then 'rare' when 'mariscada' then 'epic' when 'amnistia' then 'legendary' end $$;
create or replace function public.fn_max_level(p_id text) returns integer language sql immutable as $$
  select case p_id when 'inflacion' then 10 when 'joyas' then 10 when 'apagon' then 10 when 'mariscada' then 8 when 'amnistia' then 5 end $$;
create or replace function public.fn_frags_needed(p_id text, p_level integer) returns integer language sql immutable as $$
  select case public.fn_rarity(p_id) when 'common' then 1 + ceil(p_level / 2.0)::integer when 'rare' then 1 + ceil(p_level / 3.0)::integer when 'epic' then 1 + floor(p_level / 3.0)::integer else 1 end $$;
create or replace function public.fn_upgrade_cost(p_id text, p_level integer, p_cards jsonb) returns integer language plpgsql immutable as $$
declare r text := public.fn_rarity(p_id); base numeric; growth numeric; disc numeric;
begin
  base := case r when 'common' then 8 when 'rare' then 12 when 'epic' then 18 else 30 end;
  growth := case r when 'common' then 1.42 when 'rare' then 1.45 when 'epic' then 1.5 else 1.55 end;
  disc := least(0.32, 0.04 * public.fn_card_level(p_cards, 'mariscada'));
  return greatest(1, round(base * power(growth, p_level - 1) * (1 - disc))::integer);
end $$;
create or replace function public.fn_clicks_per_tap(p_cards jsonb, p_falcon timestamptz) returns integer language sql immutable as $$
  select (1 + public.fn_card_level(p_cards, 'inflacion')) * case when p_falcon is not null and p_falcon > now() then 5 else 1 end $$;

-- Sorteo de un cofre. Devuelve {reward, cards} con las cartas ya aplicadas.
create or replace function public.fn_roll_chest(p_kind text, p_cards jsonb) returns jsonb language plpgsql volatile as $$
declare
  cards jsonb := p_cards; shift numeric := 0.06 * public.fn_card_level(p_cards, 'amnistia');
  w_common numeric; w_rare numeric; w_epic numeric; w_leg numeric; moved numeric; rest numeric;
  n_cards integer; t_min integer; t_max integer; p_chance numeric; p_min integer; p_max integer;
  i integer; r numeric; rar text; cid text; is_new boolean; lvl integer; rewards jsonb := '[]'::jsonb; tomatoes integer; pesetas integer := 0; extra integer := 0;
begin
  if p_kind = 'wood' then w_common := 55; w_rare := 15; w_epic := 11; w_leg := 4; n_cards := 1; t_min := 2; t_max := 6; p_chance := 0.2; p_min := 1; p_max := 2;
  else w_common := 30; w_rare := 19; w_epic := 22; w_leg := 10; n_cards := 3; t_min := 10; t_max := 25; p_chance := 0.6; p_min := 3; p_max := 8; end if;
  moved := w_common * shift; w_common := w_common - moved; rest := w_rare + w_epic + w_leg;
  w_rare := w_rare + moved * w_rare / rest; w_epic := w_epic + moved * w_epic / rest; w_leg := w_leg + moved * w_leg / rest;
  if random() < shift then extra := 1; end if;
  for i in 1 .. n_cards + extra loop
    r := random() * (w_common + w_rare + w_epic + w_leg);
    if r < w_common then rar := 'common'; elsif r < w_common + w_rare then rar := 'rare'; elsif r < w_common + w_rare + w_epic then rar := 'epic'; else rar := 'legendary'; end if;
    cid := case rar when 'common' then 'inflacion' when 'rare' then (case when random() < 0.5 then 'joyas' else 'apagon' end) when 'epic' then 'mariscada' else 'amnistia' end;
    lvl := public.fn_card_level(cards, cid);
    if lvl = 0 then is_new := true; cards := jsonb_set(cards, array[cid], jsonb_build_object('level', 1, 'frags', 0));
    else is_new := false; cards := jsonb_set(cards, array[cid], jsonb_build_object('level', lvl, 'frags', public.fn_card_frags(cards, cid) + 1)); end if;
    rewards := rewards || jsonb_build_object('id', cid, 'rarity', rar, 'isNew', is_new, 'bonus', i > n_cards);
  end loop;
  tomatoes := t_min + floor(random() * (t_max - t_min + 1))::integer;
  if random() < p_chance then pesetas := p_min + floor(random() * (p_max - p_min + 1))::integer; end if;
  return jsonb_build_object('reward', jsonb_build_object('kind', p_kind, 'cards', rewards, 'tomatoes', tomatoes, 'pesetas', pesetas), 'cards', cards);
end $$;

-- 3. Funciones públicas (RPC) ------------------------------------------------------------------
create or replace function public.open_chest(p_kind text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cur public.profiles; price integer; roll jsonb; row_out public.profiles;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if p_kind not in ('wood', 'diamond') then raise exception 'Cofre desconocido'; end if;
  price := case p_kind when 'wood' then 15 else 80 end;
  select * into cur from public.profiles where user_id = auth.uid() for update;
  if not found then raise exception 'Perfil no encontrado'; end if;
  if cur.pesetas < price then raise exception 'No tienes pesetas suficientes'; end if;
  roll := public.fn_roll_chest(p_kind, cur.cards);
  update public.profiles set cards = roll->'cards', chest_tomatoes = chest_tomatoes + (roll->'reward'->>'tomatoes')::integer,
    chest_pesetas = chest_pesetas + (roll->'reward'->>'pesetas')::integer, pesetas_spent = pesetas_spent + price, chests_opened = chests_opened + 1, updated_at = now()
  where user_id = auth.uid() returning * into row_out;
  return jsonb_build_object('reward', roll->'reward', 'profile', to_jsonb(row_out));
end $$;

create or replace function public.claim_daily() returns jsonb
language plpgsql security definer set search_path = public as $$
declare cur public.profiles; today date := (now() at time zone 'Europe/Madrid')::date; roll jsonb; row_out public.profiles;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select * into cur from public.profiles where user_id = auth.uid() for update;
  if not found then raise exception 'Perfil no encontrado'; end if;
  if cur.daily_claimed_on is not null and cur.daily_claimed_on >= today then raise exception 'Ya has reclamado el cofre de hoy'; end if;
  roll := public.fn_roll_chest('wood', cur.cards);
  update public.profiles set cards = roll->'cards', chest_tomatoes = chest_tomatoes + (roll->'reward'->>'tomatoes')::integer,
    chest_pesetas = chest_pesetas + (roll->'reward'->>'pesetas')::integer, chests_opened = chests_opened + 1, daily_claimed_on = today, updated_at = now()
  where user_id = auth.uid() returning * into row_out;
  return jsonb_build_object('reward', roll->'reward', 'profile', to_jsonb(row_out));
end $$;

create or replace function public.upgrade_card(p_card text) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare cur public.profiles; lvl integer; cost integer; need integer; row_out public.profiles;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if p_card not in ('inflacion', 'joyas', 'mariscada', 'apagon', 'amnistia') then raise exception 'Carta desconocida'; end if;
  select * into cur from public.profiles where user_id = auth.uid() for update;
  lvl := public.fn_card_level(cur.cards, p_card);
  if lvl < 1 then raise exception 'No tienes esta carta'; end if;
  if lvl >= public.fn_max_level(p_card) then raise exception 'La carta ya está al máximo'; end if;
  need := public.fn_frags_needed(p_card, lvl); cost := public.fn_upgrade_cost(p_card, lvl, cur.cards);
  if public.fn_card_frags(cur.cards, p_card) < need then raise exception 'Te faltan fragmentos'; end if;
  if cur.pesetas < cost then raise exception 'No tienes pesetas suficientes'; end if;
  update public.profiles set cards = jsonb_set(cards, array[p_card], jsonb_build_object('level', lvl + 1, 'frags', public.fn_card_frags(cur.cards, p_card) - need)),
    pesetas_spent = pesetas_spent + cost, updated_at = now() where user_id = auth.uid() returning * into row_out;
  return row_out;
end $$;

-- Guardado validado: los totales no bajan y están acotados.
drop function if exists public.save_progress(bigint, integer, integer, integer);
create or replace function public.save_progress(p_total_clicks bigint, p_tomatoes_thrown integer, p_hits integer, p_perfects integer, p_falls integer, p_pesetas_earned integer)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare cur public.profiles; new_row public.profiles; secs numeric; max_clicks bigint; v_clicks bigint; v_thrown integer; v_hits integer; v_perf integer; v_falls integer; v_pes integer;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select * into cur from public.profiles where user_id = auth.uid() for update;
  if not found then insert into public.profiles (user_id) values (auth.uid()) returning * into cur; end if;
  v_clicks := greatest(cur.total_clicks, coalesce(p_total_clicks, 0));
  -- límite contra automatizaciones: máx. 25 pulsaciones/segundo (por los clics de cada pulsación) desde el último guardado, +600 de margen
  secs := extract(epoch from (now() - cur.updated_at));
  max_clicks := cur.total_clicks + 600 * public.fn_clicks_per_tap(cur.cards, cur.falcon_until) + floor(secs * 25 * public.fn_clicks_per_tap(cur.cards, cur.falcon_until))::bigint;
  v_clicks := least(v_clicks, max_clicks);
  v_thrown := least(greatest(cur.tomatoes_thrown, coalesce(p_tomatoes_thrown, 0)), (v_clicks / 100)::integer + cur.chest_tomatoes);
  v_hits := least(greatest(cur.hits, coalesce(p_hits, 0)), v_thrown);
  v_perf := least(greatest(cur.perfects, coalesce(p_perfects, 0)), v_hits);
  v_falls := least(greatest(cur.falls, coalesce(p_falls, 0)), v_hits);
  v_pes := least(greatest(cur.pesetas_earned, coalesce(p_pesetas_earned, 0)), v_falls * 3);
  update public.profiles set total_clicks = v_clicks, tomatoes_thrown = v_thrown, hits = v_hits, perfects = v_perf, falls = v_falls, pesetas_earned = v_pes, updated_at = now()
  where user_id = auth.uid() returning * into new_row;
  return new_row;
end $$;

-- Importa una sola vez el progreso de invitado (perfil recién creado y vacío), con topes.
create or replace function public.import_guest(p jsonb) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare cur public.profiles; row_out public.profiles; c jsonb := '{}'::jsonb; cid text; lvl integer; fr integer; v_clicks bigint; v_ct integer; v_thrown integer; v_hits integer; v_perf integer; v_falls integer; v_pes integer; v_cp integer; v_spent integer;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select * into cur from public.profiles where user_id = auth.uid() for update;
  if cur.total_clicks > 0 or cur.chests_opened > 0 or cur.tomatoes_thrown > 0 then raise exception 'El perfil ya tiene progreso'; end if;
  v_clicks := least(greatest(coalesce((p->>'totalClicks')::bigint, 0), 0), 500000);
  v_ct := least(greatest(coalesce((p->>'chestTomatoes')::integer, 0), 0), 3000);
  v_thrown := least(greatest(coalesce((p->>'tomatoesThrown')::integer, 0), 0), (v_clicks / 100)::integer + v_ct);
  v_hits := least(greatest(coalesce((p->>'hits')::integer, 0), 0), v_thrown);
  v_perf := least(greatest(coalesce((p->>'perfects')::integer, 0), 0), v_hits);
  v_falls := least(greatest(coalesce((p->>'falls')::integer, 0), 0), v_hits);
  v_pes := least(greatest(coalesce((p->>'pesetasEarned')::integer, 0), 0), v_falls * 3);
  v_cp := least(greatest(coalesce((p->>'chestPesetas')::integer, 0), 0), 800);
  v_spent := least(greatest(coalesce((p->>'pesetasSpent')::integer, 0), 0), v_pes + v_cp);
  foreach cid in array array['inflacion', 'joyas', 'mariscada', 'apagon', 'amnistia'] loop
    lvl := least(greatest(coalesce((p->'cards'->cid->>'level')::integer, 0), 0), public.fn_max_level(cid));
    fr := least(greatest(coalesce((p->'cards'->cid->>'frags')::integer, 0), 0), 200);
    c := c || jsonb_build_object(cid, jsonb_build_object('level', lvl, 'frags', fr));
  end loop;
  update public.profiles set total_clicks = v_clicks, chest_tomatoes = v_ct, tomatoes_thrown = v_thrown, hits = v_hits, perfects = v_perf, falls = v_falls,
    pesetas_earned = v_pes, chest_pesetas = v_cp, pesetas_spent = v_spent, cards = c, chests_opened = least(greatest(coalesce((p->>'chestsOpened')::integer, 0), 0), 500),
    daily_claimed_on = (p->>'dailyClaimedOn')::date, updated_at = now() where user_id = auth.uid() returning * into row_out;
  return row_out;
end $$;

-- Recompensas por vídeo: PENDIENTE de proveedor. Aquí se verificará el token del proveedor (callback servidor a servidor)
-- antes de conceder: Falcón (falcon_until = now() + 10 min) o Sobre de la Moncloa (chest_pesetas + 5).
create or replace function public.claim_ad_reward(p_placement text, p_token text) returns public.profiles
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  raise exception 'Los anuncios recompensados todavía no están disponibles';
end $$;

-- Hora del servidor (cofre diario), accesible sin cuenta.
create or replace function public.server_now() returns jsonb language sql stable as $$
  select jsonb_build_object('date', (now() at time zone 'Europe/Madrid')::date, 'now', now(),
    'next_midnight', (((now() at time zone 'Europe/Madrid')::date + 1)::timestamp at time zone 'Europe/Madrid')) $$;

-- 4. Permisos ------------------------------------------------------------------------------------
revoke all on function public.fn_roll_chest(text, jsonb) from public, anon, authenticated;
grant execute on function public.open_chest(text), public.claim_daily(), public.upgrade_card(text), public.import_guest(jsonb), public.claim_ad_reward(text, text) to authenticated;
grant execute on function public.save_progress(bigint, integer, integer, integer, integer, integer) to authenticated;
grant execute on function public.server_now() to anon, authenticated;
revoke execute on function public.open_chest(text), public.claim_daily(), public.upgrade_card(text), public.import_guest(jsonb), public.claim_ad_reward(text, text), public.save_progress(bigint, integer, integer, integer, integer, integer) from anon;

-- 5. Ranking por tomates históricos --------------------------------------------------------------
create or replace view public.leaderboard with (security_invoker = false) as
  select username, tomatoes_earned, falls, perfects, hits
  from public.profiles where tomatoes_earned > 0
  order by tomatoes_earned desc, falls desc limit 50;
grant select on public.leaderboard to anon, authenticated;

-- ===================================================================== schema_v3.sql
-- AL AGUA PEDRO · versión 3 del esquema (ejecutar DESPUÉS de schema.sql y schema_v2.sql).
-- Cambios que acompañan a la nueva versión del juego:
--  1. Cofres más baratos: madera 8 pesetas (antes 15), diamante 40 (antes 80).
--  2. Racha de pulsaciones (hasta ×3): el límite contra automatizaciones sube de 25 a 75 clics por segundo
--     (por los clics de cada pulsación), con más margen.
--  3. Regalo de bienvenida para cuentas nuevas: 5 tomates y 10 pesetas (los invitados ya lo reciben en el juego).
-- Conserva todos los jugadores y su progreso. Se puede ejecutar más de una vez.

alter table public.profiles alter column chest_tomatoes set default 5;
alter table public.profiles alter column chest_pesetas set default 10;

create or replace function public.save_progress(p_total_clicks bigint, p_tomatoes_thrown integer, p_hits integer, p_perfects integer, p_falls integer, p_pesetas_earned integer)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare cur public.profiles; new_row public.profiles; secs numeric; max_clicks bigint; v_clicks bigint; v_thrown integer; v_hits integer; v_perf integer; v_falls integer; v_pes integer;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select * into cur from public.profiles where user_id = auth.uid() for update;
  if not found then insert into public.profiles (user_id) values (auth.uid()) returning * into cur; end if;
  v_clicks := greatest(cur.total_clicks, coalesce(p_total_clicks, 0));
  -- límite contra automatizaciones: máx. 25 pulsaciones/segundo con la racha ×3 (75 por los clics de cada pulsación) desde el último guardado, +1800 de margen
  secs := extract(epoch from (now() - cur.updated_at));
  max_clicks := cur.total_clicks + 1800 * public.fn_clicks_per_tap(cur.cards, cur.falcon_until) + floor(secs * 75 * public.fn_clicks_per_tap(cur.cards, cur.falcon_until))::bigint;
  v_clicks := least(v_clicks, max_clicks);
  v_thrown := least(greatest(cur.tomatoes_thrown, coalesce(p_tomatoes_thrown, 0)), (v_clicks / 100)::integer + cur.chest_tomatoes);
  v_hits := least(greatest(cur.hits, coalesce(p_hits, 0)), v_thrown);
  v_perf := least(greatest(cur.perfects, coalesce(p_perfects, 0)), v_hits);
  v_falls := least(greatest(cur.falls, coalesce(p_falls, 0)), v_hits);
  v_pes := least(greatest(cur.pesetas_earned, coalesce(p_pesetas_earned, 0)), v_falls * 3);
  update public.profiles set total_clicks = v_clicks, tomatoes_thrown = v_thrown, hits = v_hits, perfects = v_perf, falls = v_falls, pesetas_earned = v_pes, updated_at = now()
  where user_id = auth.uid() returning * into new_row;
  return new_row;
end $$;

create or replace function public.open_chest(p_kind text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cur public.profiles; price integer; roll jsonb; row_out public.profiles;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if p_kind not in ('wood', 'diamond') then raise exception 'Cofre desconocido'; end if;
  price := case p_kind when 'wood' then 8 else 40 end;
  select * into cur from public.profiles where user_id = auth.uid() for update;
  if not found then raise exception 'Perfil no encontrado'; end if;
  if cur.pesetas < price then raise exception 'No tienes pesetas suficientes'; end if;
  roll := public.fn_roll_chest(p_kind, cur.cards);
  update public.profiles set cards = roll->'cards', chest_tomatoes = chest_tomatoes + (roll->'reward'->>'tomatoes')::integer,
    chest_pesetas = chest_pesetas + (roll->'reward'->>'pesetas')::integer, pesetas_spent = pesetas_spent + price, chests_opened = chests_opened + 1, updated_at = now()
  where user_id = auth.uid() returning * into row_out;
  return jsonb_build_object('reward', roll->'reward', 'profile', to_jsonb(row_out));
end $$;

-- ===================================================================== schema_v4.sql
-- AL AGUA PEDRO · versión 4 del esquema (ejecutar DESPUÉS de schema.sql, schema_v2.sql y schema_v3.sql).
-- Cambios que acompañan a la nueva versión del juego:
--  1. Un tomate cuesta 200 clics (antes 100). Los tomates que cada jugador ya había conseguido se CONSERVAN:
--     se guardan una sola vez en legacy_clicks / legacy_tomatoes y solo los clics nuevos van a 200 por tomate.
--  2. Cartas: para desbloquear hacen falta fragmentos (común 2, rara 3, épica 5, legendaria 6; antes de tenerla
--     cada aparición da 1). Ya desbloqueada, cada aparición da más (común 3, rara 3, épica 2, legendaria 2).
--     Las mejoras piden algo más de fragmentos para compensar.
-- Conserva todos los jugadores y su progreso. Se puede ejecutar más de una vez.

-- 1. Tomates conseguidos antes del cambio ------------------------------------------------------------
alter table public.profiles
  add column if not exists legacy_clicks bigint not null default 0 check (legacy_clicks >= 0),
  add column if not exists legacy_tomatoes integer not null default 0 check (legacy_tomatoes >= 0);
create table if not exists public.aap_migrations (name text primary key, done_at timestamptz not null default now());
revoke all on public.aap_migrations from public, anon, authenticated;
do $$ begin
  if not exists (select 1 from public.aap_migrations where name = 'v4_200_clics') then
    update public.profiles set legacy_clicks = total_clicks - (total_clicks % 100), legacy_tomatoes = (total_clicks / 100)::integer;
    insert into public.aap_migrations (name) values ('v4_200_clics');
  end if;
end $$;

-- 2. Columnas calculadas con 200 clics por tomate ----------------------------------------------------
drop view if exists public.leaderboard;
alter table public.profiles drop column if exists tomatoes_earned, drop column if exists clicks_progress, drop column if exists tomatoes;
alter table public.profiles
  add column tomatoes_earned integer generated always as (legacy_tomatoes + ((total_clicks - legacy_clicks) / 200)::integer + chest_tomatoes) stored,
  add column clicks_progress integer generated always as (((total_clicks - legacy_clicks) % 200)::integer) stored,
  add column tomatoes integer generated always as (legacy_tomatoes + ((total_clicks - legacy_clicks) / 200)::integer + chest_tomatoes - tomatoes_thrown) stored;
create or replace view public.leaderboard with (security_invoker = false) as
  select username, tomatoes_earned, falls, perfects, hits
  from public.profiles where tomatoes_earned > 0
  order by tomatoes_earned desc, falls desc limit 50;
grant select on public.leaderboard to anon, authenticated;

-- 3. Cartas: desbloqueo por fragmentos y más fragmentos una vez desbloqueadas -----------------------
create or replace function public.fn_unlock_need(p_rarity text) returns integer language sql immutable as $$
  select case p_rarity when 'common' then 2 when 'rare' then 3 when 'epic' then 5 else 6 end $$;
create or replace function public.fn_drop_frags(p_rarity text) returns integer language sql immutable as $$
  select case p_rarity when 'common' then 3 when 'rare' then 3 else 2 end $$;
create or replace function public.fn_frags_needed(p_id text, p_level integer) returns integer language sql immutable as $$
  select case public.fn_rarity(p_id) when 'common' then 2 + p_level when 'rare' then 2 + ceil(p_level * 0.7)::integer
    when 'epic' then 2 + ceil(p_level / 2.0)::integer else 2 + floor(p_level / 2.0)::integer end $$;

create or replace function public.fn_roll_chest(p_kind text, p_cards jsonb) returns jsonb language plpgsql volatile as $$
declare
  cards jsonb := p_cards; shift numeric := 0.06 * public.fn_card_level(p_cards, 'amnistia');
  w_common numeric; w_rare numeric; w_epic numeric; w_leg numeric; moved numeric; rest numeric;
  n_cards integer; t_min integer; t_max integer; p_chance numeric; p_min integer; p_max integer;
  i integer; r numeric; rar text; cid text; is_new boolean; locked boolean; lvl integer; fr integer; need integer; gained integer;
  rewards jsonb := '[]'::jsonb; tomatoes integer; pesetas integer := 0; extra integer := 0;
begin
  if p_kind = 'wood' then w_common := 55; w_rare := 15; w_epic := 11; w_leg := 4; n_cards := 1; t_min := 2; t_max := 6; p_chance := 0.2; p_min := 1; p_max := 2;
  else w_common := 30; w_rare := 19; w_epic := 22; w_leg := 10; n_cards := 3; t_min := 10; t_max := 25; p_chance := 0.6; p_min := 3; p_max := 8; end if;
  moved := w_common * shift; w_common := w_common - moved; rest := w_rare + w_epic + w_leg;
  w_rare := w_rare + moved * w_rare / rest; w_epic := w_epic + moved * w_epic / rest; w_leg := w_leg + moved * w_leg / rest;
  if random() < shift then extra := 1; end if;
  for i in 1 .. n_cards + extra loop
    r := random() * (w_common + w_rare + w_epic + w_leg);
    if r < w_common then rar := 'common'; elsif r < w_common + w_rare then rar := 'rare'; elsif r < w_common + w_rare + w_epic then rar := 'epic'; else rar := 'legendary'; end if;
    cid := case rar when 'common' then 'inflacion' when 'rare' then (case when random() < 0.5 then 'joyas' else 'apagon' end) when 'epic' then 'mariscada' else 'amnistia' end;
    lvl := public.fn_card_level(cards, cid); fr := public.fn_card_frags(cards, cid); need := public.fn_unlock_need(rar); is_new := false;
    if lvl = 0 then
      fr := fr + 1; gained := 1;
      if fr >= need then lvl := 1; fr := fr - need; is_new := true; end if;
    else fr := fr + public.fn_drop_frags(rar); gained := public.fn_drop_frags(rar); end if;
    locked := lvl = 0;
    cards := jsonb_set(cards, array[cid], jsonb_build_object('level', lvl, 'frags', fr));
    rewards := rewards || jsonb_build_object('id', cid, 'rarity', rar, 'isNew', is_new, 'bonus', i > n_cards, 'frags', gained, 'locked', locked, 'have', fr, 'need', need);
  end loop;
  tomatoes := t_min + floor(random() * (t_max - t_min + 1))::integer;
  if random() < p_chance then pesetas := p_min + floor(random() * (p_max - p_min + 1))::integer; end if;
  return jsonb_build_object('reward', jsonb_build_object('kind', p_kind, 'cards', rewards, 'tomatoes', tomatoes, 'pesetas', pesetas), 'cards', cards);
end $$;
revoke all on function public.fn_roll_chest(text, jsonb) from public, anon, authenticated;

-- 4. Guardado e importación con 200 clics por tomate -------------------------------------------------
create or replace function public.save_progress(p_total_clicks bigint, p_tomatoes_thrown integer, p_hits integer, p_perfects integer, p_falls integer, p_pesetas_earned integer)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare cur public.profiles; new_row public.profiles; secs numeric; max_clicks bigint; v_clicks bigint; v_thrown integer; v_hits integer; v_perf integer; v_falls integer; v_pes integer;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select * into cur from public.profiles where user_id = auth.uid() for update;
  if not found then insert into public.profiles (user_id) values (auth.uid()) returning * into cur; end if;
  v_clicks := greatest(cur.total_clicks, coalesce(p_total_clicks, 0));
  -- límite contra automatizaciones: máx. 25 pulsaciones/segundo con la racha ×3 (75 por los clics de cada pulsación) desde el último guardado, +1800 de margen
  secs := extract(epoch from (now() - cur.updated_at));
  max_clicks := cur.total_clicks + 1800 * public.fn_clicks_per_tap(cur.cards, cur.falcon_until) + floor(secs * 75 * public.fn_clicks_per_tap(cur.cards, cur.falcon_until))::bigint;
  v_clicks := least(v_clicks, max_clicks);
  v_thrown := least(greatest(cur.tomatoes_thrown, coalesce(p_tomatoes_thrown, 0)), cur.legacy_tomatoes + ((v_clicks - cur.legacy_clicks) / 200)::integer + cur.chest_tomatoes);
  v_hits := least(greatest(cur.hits, coalesce(p_hits, 0)), v_thrown);
  v_perf := least(greatest(cur.perfects, coalesce(p_perfects, 0)), v_hits);
  v_falls := least(greatest(cur.falls, coalesce(p_falls, 0)), v_hits);
  v_pes := least(greatest(cur.pesetas_earned, coalesce(p_pesetas_earned, 0)), v_falls * 3);
  update public.profiles set total_clicks = v_clicks, tomatoes_thrown = v_thrown, hits = v_hits, perfects = v_perf, falls = v_falls, pesetas_earned = v_pes, updated_at = now()
  where user_id = auth.uid() returning * into new_row;
  return new_row;
end $$;

create or replace function public.import_guest(p jsonb) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare cur public.profiles; row_out public.profiles; c jsonb := '{}'::jsonb; cid text; lvl integer; fr integer; v_clicks bigint; v_ct integer; v_thrown integer; v_hits integer; v_perf integer; v_falls integer; v_pes integer; v_cp integer; v_spent integer; v_lc bigint; v_lt integer;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select * into cur from public.profiles where user_id = auth.uid() for update;
  if cur.total_clicks > 0 or cur.chests_opened > 0 or cur.tomatoes_thrown > 0 then raise exception 'El perfil ya tiene progreso'; end if;
  v_clicks := least(greatest(coalesce((p->>'totalClicks')::bigint, 0), 0), 500000);
  v_ct := least(greatest(coalesce((p->>'chestTomatoes')::integer, 0), 0), 3000);
  -- tomatoes conseguidos cuando costaban 100 clics (partidas anteriores al cambio)
  v_lc := least(greatest(coalesce((p->>'legacyClicks')::bigint, 0), 0), v_clicks);
  v_lt := least(greatest(coalesce((p->>'legacyTomatoes')::integer, 0), 0), (v_lc / 100)::integer);
  v_thrown := least(greatest(coalesce((p->>'tomatoesThrown')::integer, 0), 0), v_lt + ((v_clicks - v_lc) / 200)::integer + v_ct);
  v_hits := least(greatest(coalesce((p->>'hits')::integer, 0), 0), v_thrown);
  v_perf := least(greatest(coalesce((p->>'perfects')::integer, 0), 0), v_hits);
  v_falls := least(greatest(coalesce((p->>'falls')::integer, 0), 0), v_hits);
  v_pes := least(greatest(coalesce((p->>'pesetasEarned')::integer, 0), 0), v_falls * 3);
  v_cp := least(greatest(coalesce((p->>'chestPesetas')::integer, 0), 0), 800);
  v_spent := least(greatest(coalesce((p->>'pesetasSpent')::integer, 0), 0), v_pes + v_cp);
  foreach cid in array array['inflacion', 'joyas', 'mariscada', 'apagon', 'amnistia'] loop
    lvl := least(greatest(coalesce((p->'cards'->cid->>'level')::integer, 0), 0), public.fn_max_level(cid));
    fr := least(greatest(coalesce((p->'cards'->cid->>'frags')::integer, 0), 0), 200);
    c := c || jsonb_build_object(cid, jsonb_build_object('level', lvl, 'frags', fr));
  end loop;
  update public.profiles set total_clicks = v_clicks, legacy_clicks = v_lc, legacy_tomatoes = v_lt, chest_tomatoes = v_ct, tomatoes_thrown = v_thrown, hits = v_hits, perfects = v_perf, falls = v_falls,
    pesetas_earned = v_pes, chest_pesetas = v_cp, pesetas_spent = v_spent, cards = c, chests_opened = least(greatest(coalesce((p->>'chestsOpened')::integer, 0), 0), 500),
    daily_claimed_on = (p->>'dailyClaimedOn')::date, updated_at = now() where user_id = auth.uid() returning * into row_out;
  return row_out;
end $$;

-- ===================================================================== schema_v5.sql
-- AL AGUA PEDRO · versión 5 del esquema (ejecutar DESPUÉS de schema.sql, schema_v2.sql, schema_v3.sql y schema_v4.sql).
-- Cambios que acompañan a la nueva versión del juego (mismas reglas que js/economy.js):
--  1. Muchos más niveles: Inflación 30, Joyas 25, Mariscada 25, Apagón 25, Amnistía 20.
--  2. Precio de mejora = base × nivel^1,5 × (1 − descuento de Mariscada).
--  3. Mariscada con rendimiento decreciente: descuento = 40 % × (1 − e^(−nivel/8)).
--  4. Amnistía ya no cambia los cofres (ahora perdona fallos en el juego).
--  5. Las cartas al nivel máximo ya no salen en los cofres; si toda la colección está al máximo, cada carta se cambia por 3 pesetas.
-- (Joyas, Apagón y Amnistía se calculan en el juego; el servidor sigue limitando las pesetas a 3 por caída y las caídas a los impactos.)
-- Conserva todos los jugadores y su progreso. Se puede ejecutar más de una vez.

create or replace function public.fn_max_level(p_id text) returns integer language sql immutable as $$
  select case p_id when 'inflacion' then 30 when 'joyas' then 25 when 'apagon' then 25 when 'mariscada' then 25 when 'amnistia' then 20 end $$;

create or replace function public.fn_upgrade_cost(p_id text, p_level integer, p_cards jsonb) returns integer language plpgsql immutable as $$
declare r text := public.fn_rarity(p_id); base numeric; disc double precision;
begin
  base := case r when 'common' then 8 when 'rare' then 12 when 'epic' then 18 else 30 end;
  disc := 0.40 * (1 - exp(-public.fn_card_level(p_cards, 'mariscada') / 8.0::double precision));
  return greatest(1, round((base * power(p_level::double precision, 1.5) * (1 - disc))::numeric)::integer);
end $$;

create or replace function public.fn_roll_chest(p_kind text, p_cards jsonb) returns jsonb language plpgsql volatile as $$
declare
  cards jsonb := p_cards;
  w_common numeric; w_rare numeric; w_epic numeric; w_leg numeric; total numeric;
  n_cards integer; t_min integer; t_max integer; p_chance numeric; p_min integer; p_max integer;
  i integer; r numeric; rar text; cid text; pool text[]; is_new boolean; locked boolean; lvl integer; fr integer; need integer; gained integer;
  rewards jsonb := '[]'::jsonb; tomatoes integer; pesetas integer := 0;
begin
  if p_kind = 'wood' then w_common := 55; w_rare := 15; w_epic := 11; w_leg := 4; n_cards := 1; t_min := 2; t_max := 6; p_chance := 0.2; p_min := 1; p_max := 2;
  else w_common := 30; w_rare := 19; w_epic := 22; w_leg := 10; n_cards := 3; t_min := 10; t_max := 25; p_chance := 0.6; p_min := 3; p_max := 8; end if;
  -- las rarezas cuyas cartas están todas al máximo ya no salen
  if public.fn_card_level(cards, 'inflacion') >= public.fn_max_level('inflacion') then w_common := 0; end if;
  if public.fn_card_level(cards, 'joyas') >= public.fn_max_level('joyas') and public.fn_card_level(cards, 'apagon') >= public.fn_max_level('apagon') then w_rare := 0; end if;
  if public.fn_card_level(cards, 'mariscada') >= public.fn_max_level('mariscada') then w_epic := 0; end if;
  if public.fn_card_level(cards, 'amnistia') >= public.fn_max_level('amnistia') then w_leg := 0; end if;
  total := w_common + w_rare + w_epic + w_leg;
  for i in 1 .. n_cards loop
    if total = 0 then pesetas := pesetas + 3; continue; end if;
    r := random() * total;
    if r < w_common then rar := 'common'; elsif r < w_common + w_rare then rar := 'rare'; elsif r < w_common + w_rare + w_epic then rar := 'epic'; else rar := 'legendary'; end if;
    select array_agg(x) into pool from unnest(case rar when 'common' then array['inflacion'] when 'rare' then array['joyas', 'apagon'] when 'epic' then array['mariscada'] else array['amnistia'] end) x
      where public.fn_card_level(cards, x) < public.fn_max_level(x);
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

-- ===================================================================== schema_v6.sql
-- AL AGUA PEDRO · versión 6 del esquema (ejecutar DESPUÉS de schema.sql y de schema_v2.sql a schema_v5.sql).
-- Cuatro cartas nuevas (mismas reglas que js/economy.js):
--  · Plus Ultra (común, 25 niveles): si fallas, a veces recuperas los tomates  -> columna tomatoes_refunded
--  · Hacienda Inversa (rara, 20): te devuelve una parte de cada gasto (cofres y mejoras) -> va a chest_pesetas
--  · Puerta Giratoria (épica, 20): 2 tomates por nivel en cada mejora                    -> va a chest_tomatoes
--  · Paguitas (legendaria, 15): 3 pesetas cada 120·0,88^(nivel−1) segundos               -> columna paguitas_pesetas
-- El guardado valida lo nuevo: tomates recuperados ≤ lanzamientos fallados; paguitas limitadas por el tiempo transcurrido.
-- Conserva todos los jugadores y su progreso. Se puede ejecutar más de una vez.

-- 1. Columnas nuevas y columnas calculadas -----------------------------------------------------------
alter table public.profiles
  add column if not exists tomatoes_refunded integer not null default 0 check (tomatoes_refunded >= 0),
  add column if not exists paguitas_pesetas integer not null default 0 check (paguitas_pesetas >= 0);
alter table public.profiles drop column if exists tomatoes, drop column if exists pesetas;
alter table public.profiles
  add column tomatoes integer generated always as (legacy_tomatoes + ((total_clicks - legacy_clicks) / 200)::integer + chest_tomatoes + tomatoes_refunded - tomatoes_thrown) stored,
  add column pesetas integer generated always as (pesetas_earned + chest_pesetas + paguitas_pesetas - pesetas_spent) stored;

-- 2. Cartas -------------------------------------------------------------------------------------------
create or replace function public.fn_rarity(p_id text) returns text language sql immutable as $$
  select case p_id when 'inflacion' then 'common' when 'plusultra' then 'common' when 'joyas' then 'rare' when 'apagon' then 'rare' when 'hacienda' then 'rare'
    when 'mariscada' then 'epic' when 'puerta' then 'epic' when 'amnistia' then 'legendary' when 'paguitas' then 'legendary' end $$;
create or replace function public.fn_max_level(p_id text) returns integer language sql immutable as $$
  select case p_id when 'inflacion' then 30 when 'joyas' then 25 when 'apagon' then 25 when 'mariscada' then 25 when 'amnistia' then 20
    when 'plusultra' then 25 when 'hacienda' then 20 when 'puerta' then 20 when 'paguitas' then 15 end $$;
create or replace function public.fn_rarity_cards(p_rarity text) returns text[] language sql immutable as $$
  select case p_rarity when 'common' then array['inflacion', 'plusultra'] when 'rare' then array['joyas', 'apagon', 'hacienda']
    when 'epic' then array['mariscada', 'puerta'] else array['amnistia', 'paguitas'] end $$;
-- ¿queda alguna carta de esa rareza sin llegar al máximo?
create or replace function public.fn_rarity_open(p_cards jsonb, p_rarity text) returns boolean language sql immutable as $$
  select exists (select 1 from unnest(public.fn_rarity_cards(p_rarity)) x where public.fn_card_level(p_cards, x) < public.fn_max_level(x)) $$;
-- Hacienda Inversa: pesetas devueltas por un gasto
create or replace function public.fn_refund(p_cards jsonb, p_spent integer) returns integer language sql immutable as $$
  select case when public.fn_card_level(p_cards, 'hacienda') = 0 or p_spent <= 0 then 0
    else greatest(1, round((p_spent * 0.30 * (1 - exp(-public.fn_card_level(p_cards, 'hacienda') / 8.0::double precision)))::numeric)::integer) end $$;

create or replace function public.fn_roll_chest(p_kind text, p_cards jsonb) returns jsonb language plpgsql volatile as $$
declare
  cards jsonb := p_cards;
  w_common numeric; w_rare numeric; w_epic numeric; w_leg numeric; total numeric;
  n_cards integer; t_min integer; t_max integer; p_chance numeric; p_min integer; p_max integer;
  i integer; r numeric; rar text; cid text; pool text[]; is_new boolean; locked boolean; lvl integer; fr integer; need integer; gained integer;
  rewards jsonb := '[]'::jsonb; tomatoes integer; pesetas integer := 0;
begin
  if p_kind = 'wood' then w_common := 55; w_rare := 15; w_epic := 11; w_leg := 4; n_cards := 1; t_min := 2; t_max := 6; p_chance := 0.2; p_min := 1; p_max := 2;
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

-- 3. Cofres y mejoras con Hacienda Inversa y Puerta Giratoria -------------------------------------------
create or replace function public.open_chest(p_kind text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cur public.profiles; price integer; roll jsonb; row_out public.profiles; back integer;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if p_kind not in ('wood', 'diamond') then raise exception 'Cofre desconocido'; end if;
  price := case p_kind when 'wood' then 8 else 40 end;
  select * into cur from public.profiles where user_id = auth.uid() for update;
  if not found then raise exception 'Perfil no encontrado'; end if;
  if cur.pesetas < price then raise exception 'No tienes pesetas suficientes'; end if;
  back := public.fn_refund(cur.cards, price);              -- Hacienda Inversa (con las cartas de antes de abrir)
  roll := public.fn_roll_chest(p_kind, cur.cards);
  update public.profiles set cards = roll->'cards', chest_tomatoes = chest_tomatoes + (roll->'reward'->>'tomatoes')::integer,
    chest_pesetas = chest_pesetas + (roll->'reward'->>'pesetas')::integer + back, pesetas_spent = pesetas_spent + price, chests_opened = chests_opened + 1, updated_at = now()
  where user_id = auth.uid() returning * into row_out;
  return jsonb_build_object('reward', (roll->'reward') || jsonb_build_object('refund', back), 'profile', to_jsonb(row_out));
end $$;

create or replace function public.upgrade_card(p_card text) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare cur public.profiles; lvl integer; cost integer; need integer; row_out public.profiles; back integer; toms integer;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if p_card not in ('inflacion', 'joyas', 'mariscada', 'apagon', 'amnistia', 'plusultra', 'hacienda', 'puerta', 'paguitas') then raise exception 'Carta desconocida'; end if;
  select * into cur from public.profiles where user_id = auth.uid() for update;
  lvl := public.fn_card_level(cur.cards, p_card);
  if lvl < 1 then raise exception 'No tienes esta carta'; end if;
  if lvl >= public.fn_max_level(p_card) then raise exception 'La carta ya está al máximo'; end if;
  need := public.fn_frags_needed(p_card, lvl); cost := public.fn_upgrade_cost(p_card, lvl, cur.cards);
  if public.fn_card_frags(cur.cards, p_card) < need then raise exception 'Te faltan fragmentos'; end if;
  if cur.pesetas < cost then raise exception 'No tienes pesetas suficientes'; end if;
  back := public.fn_refund(cur.cards, cost);                 -- Hacienda Inversa
  toms := 2 * public.fn_card_level(cur.cards, 'puerta');     -- Puerta Giratoria
  update public.profiles set cards = jsonb_set(cards, array[p_card], jsonb_build_object('level', lvl + 1, 'frags', public.fn_card_frags(cur.cards, p_card) - need)),
    pesetas_spent = pesetas_spent + cost, chest_pesetas = chest_pesetas + back, chest_tomatoes = chest_tomatoes + toms, updated_at = now() where user_id = auth.uid() returning * into row_out;
  return row_out;
end $$;

-- 4. Guardado e importación con tomates recuperados y paguitas --------------------------------------------
drop function if exists public.save_progress(bigint, integer, integer, integer, integer, integer);
create or replace function public.save_progress(p_total_clicks bigint, p_tomatoes_thrown integer, p_hits integer, p_perfects integer, p_falls integer, p_pesetas_earned integer, p_tomatoes_refunded integer default 0, p_paguitas_pesetas integer default 0)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare cur public.profiles; new_row public.profiles; secs numeric; max_clicks bigint; v_clicks bigint; v_thrown integer; v_hits integer; v_perf integer; v_falls integer; v_pes integer; v_ref integer; v_pag integer; lvl integer; every numeric;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select * into cur from public.profiles where user_id = auth.uid() for update;
  if not found then insert into public.profiles (user_id) values (auth.uid()) returning * into cur; end if;
  v_clicks := greatest(cur.total_clicks, coalesce(p_total_clicks, 0));
  -- límite contra automatizaciones: máx. 25 pulsaciones/segundo con la racha ×3 (75 por los clics de cada pulsación) desde el último guardado, +1800 de margen
  secs := extract(epoch from (now() - cur.updated_at));
  max_clicks := cur.total_clicks + 1800 * public.fn_clicks_per_tap(cur.cards, cur.falcon_until) + floor(secs * 75 * public.fn_clicks_per_tap(cur.cards, cur.falcon_until))::bigint;
  v_clicks := least(v_clicks, max_clicks);
  v_ref := greatest(cur.tomatoes_refunded, coalesce(p_tomatoes_refunded, 0));
  v_thrown := least(greatest(cur.tomatoes_thrown, coalesce(p_tomatoes_thrown, 0)), cur.legacy_tomatoes + ((v_clicks - cur.legacy_clicks) / 200)::integer + cur.chest_tomatoes + v_ref);
  v_hits := least(greatest(cur.hits, coalesce(p_hits, 0)), v_thrown);
  v_perf := least(greatest(cur.perfects, coalesce(p_perfects, 0)), v_hits);
  v_falls := least(greatest(cur.falls, coalesce(p_falls, 0)), v_hits);
  v_pes := least(greatest(cur.pesetas_earned, coalesce(p_pesetas_earned, 0)), v_falls * 3);
  -- Plus Ultra: solo se recuperan tomates de lanzamientos fallados
  v_ref := least(v_ref, greatest(cur.tomatoes_refunded, v_thrown - v_hits));
  -- Paguitas: como mucho 3 pesetas por cada intervalo transcurrido desde el último guardado (+2 de margen)
  lvl := public.fn_card_level(cur.cards, 'paguitas');
  if lvl = 0 then v_pag := cur.paguitas_pesetas;
  else every := round(120 * power(0.88, lvl - 1));
    v_pag := least(greatest(cur.paguitas_pesetas, coalesce(p_paguitas_pesetas, 0)), cur.paguitas_pesetas + 3 * (floor(secs / every)::integer + 2)); end if;
  update public.profiles set total_clicks = v_clicks, tomatoes_thrown = v_thrown, hits = v_hits, perfects = v_perf, falls = v_falls, pesetas_earned = v_pes, tomatoes_refunded = v_ref, paguitas_pesetas = v_pag, updated_at = now()
  where user_id = auth.uid() returning * into new_row;
  return new_row;
end $$;
grant execute on function public.save_progress(bigint, integer, integer, integer, integer, integer, integer, integer) to authenticated;
revoke execute on function public.save_progress(bigint, integer, integer, integer, integer, integer, integer, integer) from anon;

create or replace function public.import_guest(p jsonb) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare cur public.profiles; row_out public.profiles; c jsonb := '{}'::jsonb; cid text; lvl integer; fr integer; v_clicks bigint; v_ct integer; v_thrown integer; v_hits integer; v_perf integer; v_falls integer; v_pes integer; v_cp integer; v_spent integer; v_lc bigint; v_lt integer; v_ref integer; v_pag integer;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select * into cur from public.profiles where user_id = auth.uid() for update;
  if cur.total_clicks > 0 or cur.chests_opened > 0 or cur.tomatoes_thrown > 0 then raise exception 'El perfil ya tiene progreso'; end if;
  v_clicks := least(greatest(coalesce((p->>'totalClicks')::bigint, 0), 0), 500000);
  v_ct := least(greatest(coalesce((p->>'chestTomatoes')::integer, 0), 0), 3000);
  -- tomatoes conseguidos cuando costaban 100 clics (partidas anteriores al cambio)
  v_lc := least(greatest(coalesce((p->>'legacyClicks')::bigint, 0), 0), v_clicks);
  v_lt := least(greatest(coalesce((p->>'legacyTomatoes')::integer, 0), 0), (v_lc / 100)::integer);
  v_ref := least(greatest(coalesce((p->>'tomatoesRefunded')::integer, 0), 0), 3000);
  v_thrown := least(greatest(coalesce((p->>'tomatoesThrown')::integer, 0), 0), v_lt + ((v_clicks - v_lc) / 200)::integer + v_ct + v_ref);
  v_hits := least(greatest(coalesce((p->>'hits')::integer, 0), 0), v_thrown);
  v_perf := least(greatest(coalesce((p->>'perfects')::integer, 0), 0), v_hits);
  v_falls := least(greatest(coalesce((p->>'falls')::integer, 0), 0), v_hits);
  v_pes := least(greatest(coalesce((p->>'pesetasEarned')::integer, 0), 0), v_falls * 3);
  v_ref := least(v_ref, v_thrown - v_hits);
  v_pag := least(greatest(coalesce((p->>'paguitasPesetas')::integer, 0), 0), 5000);
  v_cp := least(greatest(coalesce((p->>'chestPesetas')::integer, 0), 0), 800);
  v_spent := least(greatest(coalesce((p->>'pesetasSpent')::integer, 0), 0), v_pes + v_cp + v_pag);
  foreach cid in array array['inflacion', 'joyas', 'mariscada', 'apagon', 'amnistia', 'plusultra', 'hacienda', 'puerta', 'paguitas'] loop
    lvl := least(greatest(coalesce((p->'cards'->cid->>'level')::integer, 0), 0), public.fn_max_level(cid));
    fr := least(greatest(coalesce((p->'cards'->cid->>'frags')::integer, 0), 0), 200);
    c := c || jsonb_build_object(cid, jsonb_build_object('level', lvl, 'frags', fr));
  end loop;
  update public.profiles set total_clicks = v_clicks, tomatoes_refunded = v_ref, paguitas_pesetas = v_pag, legacy_clicks = v_lc, legacy_tomatoes = v_lt, chest_tomatoes = v_ct, tomatoes_thrown = v_thrown, hits = v_hits, perfects = v_perf, falls = v_falls,
    pesetas_earned = v_pes, chest_pesetas = v_cp, pesetas_spent = v_spent, cards = c, chests_opened = least(greatest(coalesce((p->>'chestsOpened')::integer, 0), 0), 500),
    daily_claimed_on = (p->>'dailyClaimedOn')::date, updated_at = now() where user_id = auth.uid() returning * into row_out;
  return row_out;
end $$;

-- ===================================================================== schema_v7.sql
-- AL AGUA PEDRO · versión 7 del esquema (ejecutar DESPUÉS de schema_v6.sql; o ejecuta schema_todo.sql, que lo incluye todo).
--  · Perfil: foto de perfil (bandera) y cambio de nombre validado (único, 3-20 caracteres).
--  · Entrar con Google: el perfil toma el nombre de la cuenta de Google.
--  · Ranking con la bandera de cada jugador y posición propia (my_rank).
--  · Hacienda Inversa más moderada: devuelve como mucho un 12 % (antes 30 %).
-- Conserva todos los jugadores y su progreso. Se puede ejecutar más de una vez.

-- 1. Foto de perfil -------------------------------------------------------------------------------------
alter table public.profiles add column if not exists avatar text check (avatar is null or char_length(avatar) <= 40);

create or replace function public.fn_avatar_ok(p text) returns boolean language sql immutable as $$
  select p = any (array['espana', 'espana-escudo', 'tercios', 'cruz', 'santiago', 'castilla', 'castilla-aragon', 'leon', 'toro', 'falange', 'vox', 'gadsden',
    'andalucia', 'aragon', 'asturias', 'baleares', 'canarias', 'cantabria', 'castilla-la-mancha', 'castilla-y-leon', 'cataluna', 'valencia', 'extremadura',
    'galicia', 'madrid', 'murcia', 'navarra', 'pais-vasco', 'rioja', 'ceuta', 'melilla']) $$;

-- 2. Alta de usuarios (correo o Google) -------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, username)
  values (new.id, coalesce(left(nullif(trim(coalesce(new.raw_user_meta_data->>'username', new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')), ''), 20), 'Jugador'))
  on conflict (user_id) do nothing;
  return new;
end $$;

-- 3. Cambiar nombre y bandera ------------------------------------------------------------------------------
create or replace function public.update_profile(p_username text, p_avatar text)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare v_name text := regexp_replace(trim(coalesce(p_username, '')), '\s+', ' ', 'g'); v_old text; row_out public.profiles;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  select username into v_old from public.profiles where user_id = auth.uid();
  if v_name = '' or v_name = v_old then v_name := v_old;          -- solo cambia la bandera
  elsif char_length(v_name) < 3 or char_length(v_name) > 20 then raise exception 'El nombre debe tener entre 3 y 20 caracteres';
  elsif v_name !~ '^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñÇç _.-]+$' then raise exception 'El nombre solo puede tener letras, números, espacios, puntos y guiones';
  elsif exists (select 1 from public.profiles where lower(username) = lower(v_name) and user_id <> auth.uid()) then raise exception 'Ese nombre ya lo tiene otro jugador'; end if;
  if p_avatar is not null and not public.fn_avatar_ok(p_avatar) then raise exception 'Esa bandera no existe'; end if;
  -- no se toca updated_at: el guardado lo usa para validar el tiempo jugado
  update public.profiles set username = v_name, avatar = coalesce(p_avatar, avatar) where user_id = auth.uid() returning * into row_out;
  if row_out.user_id is null then raise exception 'El perfil no existe'; end if;
  return row_out;
end $$;
revoke all on function public.update_profile(text, text) from public, anon;
grant execute on function public.update_profile(text, text) to authenticated;

-- 4. Ranking con bandera y posición propia ------------------------------------------------------------------
drop view if exists public.leaderboard;
create view public.leaderboard with (security_invoker = false) as
  select username, tomatoes_earned, falls, perfects, hits, coalesce(avatar, 'espana') as avatar
  from public.profiles where tomatoes_earned > 0
  order by tomatoes_earned desc, falls desc limit 50;
grant select on public.leaderboard to anon, authenticated;

create or replace function public.my_rank() returns integer language sql stable security definer set search_path = public as $$
  select 1 + count(*)::integer from public.profiles p, (select tomatoes_earned t, falls f from public.profiles where user_id = auth.uid()) me
  where p.tomatoes_earned > me.t or (p.tomatoes_earned = me.t and p.falls > me.f) $$;
revoke all on function public.my_rank() from public, anon;
grant execute on function public.my_rank() to authenticated;

-- 5. Hacienda Inversa: como mucho un 12 % de lo gastado (igual que js/economy.js) -----------------------------
create or replace function public.fn_refund(p_cards jsonb, p_spent integer) returns integer language sql immutable as $$
  select case when public.fn_card_level(p_cards, 'hacienda') = 0 or p_spent <= 0 then 0
    else greatest(1, round((p_spent * 0.12 * (1 - exp(-public.fn_card_level(p_cards, 'hacienda') / 8.0::double precision)))::numeric)::integer) end $$;

-- ===================================================================== schema_v8.sql
-- AL AGUA PEDRO · versión 8 del esquema (ejecutar DESPUÉS de schema_v7.sql; o ejecuta schema_todo.sql, que lo incluye todo).
-- Las banderas del perfil se validan por formato (minúsculas, números y guiones), no con una lista fija:
-- así se pueden añadir banderas nuevas en el juego sin volver a tocar la base de datos.
-- Si alguien guarda un nombre de bandera que no existe, el juego muestra la de España.
create or replace function public.fn_avatar_ok(p text) returns boolean language sql immutable as $$
  select p ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(p) <= 40 $$;

-- ===================================================================== schema_v9.sql
-- AL AGUA PEDRO · versión 9 del esquema (ejecutar DESPUÉS de schema_v8.sql; o ejecuta schema_todo.sql, que lo incluye todo).
--  · Título del perfil personalizable (lo que sale bajo el nombre).
--  · Regalo de bienvenida: la primera vez que tiras a Pedro al agua cae un cofre en paracaídas
--    (50–60 pesetas, 30–40 tomates y 2 cartas). Se abre viendo un vídeo y caduca a los 10 minutos.
-- Conserva todos los jugadores y su progreso. Se puede ejecutar más de una vez.

alter table public.profiles
  add column if not exists title text check (title is null or char_length(title) <= 28),
  add column if not exists welcome_offered_at timestamptz,
  add column if not exists welcome_claimed boolean not null default false;

-- 1. Título del perfil -------------------------------------------------------------------------------
create or replace function public.set_title(p_title text) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare v text := regexp_replace(trim(coalesce(p_title, '')), '\s+', ' ', 'g'); row_out public.profiles;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  if char_length(v) < 2 or char_length(v) > 28 then raise exception 'El título debe tener entre 2 y 28 caracteres'; end if;
  if v !~ '^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñÇç ¡!¿?.,''-]+$' then raise exception 'El título solo puede tener letras, números, espacios y signos sencillos'; end if;
  -- no se toca updated_at: el guardado lo usa para validar el tiempo jugado
  update public.profiles set title = v where user_id = auth.uid() returning * into row_out;
  return row_out;
end $$;
revoke all on function public.set_title(text) from public, anon;
grant execute on function public.set_title(text) to authenticated;

-- 2. Cofre de bienvenida -----------------------------------------------------------------------------
create or replace function public.fn_roll_chest(p_kind text, p_cards jsonb) returns jsonb language plpgsql volatile as $$
declare
  cards jsonb := p_cards;
  w_common numeric; w_rare numeric; w_epic numeric; w_leg numeric; total numeric;
  n_cards integer; t_min integer; t_max integer; p_chance numeric; p_min integer; p_max integer;
  i integer; r numeric; rar text; cid text; pool text[]; is_new boolean; locked boolean; lvl integer; fr integer; need integer; gained integer;
  rewards jsonb := '[]'::jsonb; tomatoes integer; pesetas integer := 0;
begin
  if p_kind = 'wood' then w_common := 55; w_rare := 15; w_epic := 11; w_leg := 4; n_cards := 1; t_min := 2; t_max := 6; p_chance := 0.2; p_min := 1; p_max := 2;
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

-- Se ofrece una sola vez, cuando el servidor ya tiene al menos una caída guardada. Devuelve cuándo se ofreció.
create or replace function public.offer_welcome() returns jsonb
language plpgsql security definer set search_path = public as $$
declare cur public.profiles;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  select * into cur from public.profiles where user_id = auth.uid() for update;
  if not found then raise exception 'El perfil no existe'; end if;
  if not cur.welcome_claimed and cur.welcome_offered_at is null then
    if cur.falls < 1 then raise exception 'Primero tienes que tirar a Pedro al agua'; end if;
    update public.profiles set welcome_offered_at = now() where user_id = auth.uid() returning * into cur;
  end if;
  return jsonb_build_object('offered_at', cur.welcome_offered_at, 'claimed', cur.welcome_claimed, 'now', now());
end $$;

-- Abrir el regalo (tras el vídeo): una sola vez y antes de que caduque (10 minutos + 1 de margen).
create or replace function public.claim_welcome() returns jsonb
language plpgsql security definer set search_path = public as $$
declare cur public.profiles; roll jsonb; row_out public.profiles;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  select * into cur from public.profiles where user_id = auth.uid() for update;
  if not found then raise exception 'El perfil no existe'; end if;
  if cur.welcome_claimed then raise exception 'Ya has abierto el regalo de bienvenida'; end if;
  if cur.welcome_offered_at is null then raise exception 'Todavía no tienes el regalo de bienvenida'; end if;
  if now() > cur.welcome_offered_at + interval '11 minutes' then raise exception 'El regalo de bienvenida ha caducado'; end if;
  roll := public.fn_roll_chest('welcome', cur.cards);
  update public.profiles set cards = roll->'cards', chest_tomatoes = chest_tomatoes + (roll->'reward'->>'tomatoes')::integer,
    chest_pesetas = chest_pesetas + (roll->'reward'->>'pesetas')::integer, chests_opened = chests_opened + 1, welcome_claimed = true, updated_at = now()
  where user_id = auth.uid() returning * into row_out;
  return jsonb_build_object('reward', roll->'reward', 'profile', to_jsonb(row_out));
end $$;
revoke all on function public.offer_welcome(), public.claim_welcome() from public, anon;
grant execute on function public.offer_welcome(), public.claim_welcome() to authenticated;

-- ===================================================================== schema_v10.sql
-- AL AGUA PEDRO · versión 10 del esquema (ejecutar DESPUÉS de schema_v9.sql; o ejecuta schema_todo.sql, que lo incluye todo).
-- Vídeos recompensados de la tienda:
--  · Sobre de la Moncloa: 25 pesetas por vídeo, como mucho 10 al día.
--  · El Falcón: clics ×5 durante 10 minutos, como mucho 6 al día y solo si no está ya en marcha.
-- Los anuncios web no permiten comprobar en el servidor que el vídeo se ha visto entero, por eso hay límites diarios.
-- Conserva todos los jugadores y su progreso. Se puede ejecutar más de una vez.

alter table public.profiles add column if not exists ad_claims jsonb not null default '{}'::jsonb;

-- Interruptor: los vídeos recompensados están APAGADOS hasta que Google apruebe los anuncios.
-- Para encenderlos:  update public.aap_config set value = 'true' where key = 'rewarded_ads';
create table if not exists public.aap_config (key text primary key, value text not null);
revoke all on public.aap_config from public, anon, authenticated;
insert into public.aap_config (key, value) values ('rewarded_ads', 'false') on conflict (key) do nothing;

create or replace function public.claim_ad_reward(p_placement text, p_token text) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare cur public.profiles; today text := ((now() at time zone 'Europe/Madrid')::date)::text; claims jsonb; n integer; lim integer; row_out public.profiles;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  if coalesce((select value from public.aap_config where key = 'rewarded_ads'), 'false') <> 'true' then raise exception 'Los anuncios todavía no están disponibles'; end if;
  if p_placement not in ('falcon', 'sobre') then raise exception 'Esa oferta no existe'; end if;
  select * into cur from public.profiles where user_id = auth.uid() for update;
  if not found then raise exception 'El perfil no existe'; end if;
  claims := case when cur.ad_claims->>'day' = today then cur.ad_claims else jsonb_build_object('day', today) end;
  n := coalesce((claims->>p_placement)::integer, 0);
  lim := case p_placement when 'sobre' then 10 else 6 end;
  if n >= lim then raise exception 'Ya has visto todos los vídeos de hoy para esta oferta. Vuelve mañana'; end if;
  claims := jsonb_set(claims, array[p_placement], to_jsonb(n + 1));
  if p_placement = 'falcon' then
    if cur.falcon_until is not null and cur.falcon_until > now() then raise exception 'El Falcón ya está en marcha'; end if;
    update public.profiles set falcon_until = now() + interval '10 minutes', ad_claims = claims where user_id = auth.uid() returning * into row_out;
  else
    update public.profiles set chest_pesetas = chest_pesetas + 25, ad_claims = claims, updated_at = now() where user_id = auth.uid() returning * into row_out;
  end if;
  return row_out;
end $$;
revoke all on function public.claim_ad_reward(text, text) from public, anon;
grant execute on function public.claim_ad_reward(text, text) to authenticated;

-- ===================================================================== schema_v11.sql
-- AL AGUA PEDRO · versión 11 del esquema (ejecutar DESPUÉS de schema_v10.sql; o ejecuta schema_todo.sql, que lo incluye todo).
-- Packs de pesetas con pago real (Stripe Checkout).
--  · Las pesetas SOLO las entrega el webhook de Stripe (función supabase/functions/stripe-webhook), con la clave de servicio.
--  · Cada pago (sesión de Stripe) se entrega una sola vez aunque Stripe repita el aviso.
--  · El jugador puede ver sus propias compras (para que el juego sepa cuándo han llegado).
--  · Organización criminal 1,99 € (750 pesetas + 300 tomates), Caso Koldo 3,99 € (1.750 + 700) y
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
    when 'maletin'    then '{"pesetas": 1750, "tomatoes": 700, "cards": 0}'::jsonb
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

commit;
