-- AL AGUA PEDRO · ACTUALIZACIÓN COMPLETA (todo en uno)
-- Lleva la base de datos a la última versión desde CUALQUIER versión anterior (incluso desde cero).
-- Es lo mismo que ejecutar schema.sql y schema_v2.sql, schema_v3.sql... seguidos.
-- Conserva todos los jugadores y su progreso. Se puede ejecutar más de una vez.
-- Va todo en una transacción: si algo fallara, no se cambia nada.
begin;
-- las vistas de los rankings se rehacen más abajo (así el esquema base se puede volver a ejecutar sobre una base ya actualizada)
drop view if exists public.leaderboard;
drop view if exists public.region_ranking;
drop view if exists public.region_leaders;


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

-- ===================================================================== schema_v12.sql
-- AL AGUA PEDRO · versión 12 del esquema (ejecutar DESPUÉS de schema_v11.sql; o ejecuta schema_todo.sql, que lo incluye todo).
-- Nuevas rarezas de las cartas (igual que js/economy.js):
--  · Legendarias: Inflación y Joyas de Zapatero
--  · Épicas: Hacienda Inversa y Paguitas
--  · Poco común: Mariscada Sindical
--  · Comunes: Puerta Giratoria, Plus Ultra, Apagón y Amnistía
-- La rareza decide qué sale en cada cofre, cuántos fragmentos hacen falta para desbloquear y el precio de las mejoras.
-- Conserva los niveles y fragmentos que ya tenga cada jugador. Se puede ejecutar más de una vez.
create or replace function public.fn_rarity(p_id text) returns text language sql immutable as $$
  select case p_id
    when 'inflacion' then 'legendary' when 'joyas' then 'legendary'
    when 'hacienda' then 'epic' when 'paguitas' then 'epic'
    when 'mariscada' then 'rare'
    when 'puerta' then 'common' when 'plusultra' then 'common' when 'apagon' then 'common' when 'amnistia' then 'common' end $$;
create or replace function public.fn_rarity_cards(p_rarity text) returns text[] language sql immutable as $$
  select case p_rarity when 'common' then array['puerta', 'plusultra', 'apagon', 'amnistia'] when 'rare' then array['mariscada']
    when 'epic' then array['hacienda', 'paguitas'] else array['inflacion', 'joyas'] end $$;

-- ===================================================================== schema_v13.sql
-- AL AGUA PEDRO · versión 13 del esquema (ejecutar DESPUÉS de schema_v12.sql; o ejecuta schema_todo.sql, que lo incluye todo).
-- Niveles de jugador (1–50) y ruleta de premios (igual que js/levels.js):
--  · Experiencia = 10 por tomate lanzado + 5 por impacto + 20 por caída al agua (sale de los contadores ya guardados y validados).
--  · Cada nivel que subes da una tirada de ruleta: pesetas, tomates, cartas o ×5 clics durante 10 minutos.
--  · El servidor decide el premio y solo deja girar tantas veces como niveles hayas subido.
--  · Los jugadores que ya tenían progreso empiezan con su nivel y UNA tirada de regalo.
-- Conserva todos los jugadores y su progreso. Se puede ejecutar más de una vez.

-- XP total para llegar a cada nivel (del 2 al 50)
create or replace function public.fn_level_of_xp(p_xp bigint) returns integer language sql immutable as $$
  select 1 + count(*)::integer from unnest(array[100, 350, 810, 1530, 2560, 3940, 5710, 7900, 10560, 13720, 17410, 21660, 26510, 31990, 38120, 44940, 52470, 60750,
    69800, 79640, 90310, 101820, 114210, 127500, 141710, 156870, 173000, 190130, 208280, 227470, 247720, 269060, 291510, 315090, 339830, 365740, 392850, 421180,
    450750, 481580, 513690, 547100, 581830, 617900, 655330, 694140, 734350, 775990, 819060]::bigint[]) t where p_xp >= t $$;
create or replace function public.fn_player_xp(p_thrown bigint, p_hits bigint, p_falls bigint) returns bigint language sql immutable as $$
  select 10 * coalesce(p_thrown, 0) + 5 * coalesce(p_hits, 0) + 20 * coalesce(p_falls, 0) $$;
create or replace function public.fn_player_level(p_thrown bigint, p_hits bigint, p_falls bigint) returns integer language sql immutable as $$
  select public.fn_level_of_xp(public.fn_player_xp(p_thrown, p_hits, p_falls)) $$;

-- Hasta qué nivel ya ha girado la ruleta cada jugador. Los que ya jugaban: su nivel menos uno (una tirada de regalo).
alter table public.profiles add column if not exists wheel_level integer;
update public.profiles set wheel_level = greatest(1, public.fn_player_level(tomatoes_thrown, hits, falls) - 1) where wheel_level is null;
alter table public.profiles alter column wheel_level set default 1;
alter table public.profiles alter column wheel_level set not null;

-- Girar la ruleta: un premio por cada nivel subido. Casillas en el mismo orden que WHEEL (js/levels.js):
-- pesetas (22), tomates (20), carta (14), ×5 clics 10 min (10), más pesetas (12), más tomates (10), 3 cartas (8), bote (4)
create or replace function public.spin_level_wheel() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  cur public.profiles; row_out public.profiles; lvl integer; L integer; r numeric; idx integer := 0; acc integer := 0;
  ids text[] := array['pes_s', 'tom_s', 'card', 'x5', 'pes_m', 'tom_l', 'cards3', 'jackpot'];
  weights integer[] := array[22, 20, 14, 10, 12, 10, 8, 4];
  seg text; pes integer := 0; tom integer := 0; won jsonb := '[]'::jsonb; chest text := null; roll jsonb; fal timestamptz;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  select * into cur from public.profiles where user_id = auth.uid() for update;
  if not found then raise exception 'El perfil no existe'; end if;
  lvl := public.fn_player_level(cur.tomatoes_thrown, cur.hits, cur.falls);
  if cur.wheel_level >= lvl then raise exception 'No tienes tiradas de ruleta pendientes'; end if;
  L := cur.wheel_level + 1;                                   -- el nivel que se celebra
  r := random() * 100;
  for i in 1 .. 8 loop acc := acc + weights[i]; if r < acc then idx := i; exit; end if; end loop;
  if idx = 0 then idx := 8; end if;
  seg := ids[idx]; fal := cur.falcon_until;
  if seg = 'pes_s' then pes := 10 + 2 * L;
  elsif seg = 'tom_s' then tom := 10 + 3 * L;
  elsif seg = 'pes_m' then pes := 30 + 5 * L;
  elsif seg = 'tom_l' then tom := 30 + 8 * L;
  elsif seg = 'jackpot' then pes := 100 + 20 * L;
  elsif seg = 'x5' then fal := greatest(now(), coalesce(cur.falcon_until, now())) + interval '10 minutes';   -- si ya iba el Falcón, se alarga
  else
    chest := case when seg = 'cards3' then 'diamond' else 'wood' end;
    roll := public.fn_roll_chest(chest, cur.cards);
    cur.cards := roll->'cards'; won := roll->'reward'->'cards';
    pes := coalesce((roll->'reward'->>'pesetas')::integer, 0); tom := coalesce((roll->'reward'->>'tomatoes')::integer, 0);
  end if;
  update public.profiles set cards = cur.cards, chest_pesetas = chest_pesetas + pes, chest_tomatoes = chest_tomatoes + tom, falcon_until = fal,
    wheel_level = L, updated_at = now()
  where user_id = auth.uid() returning * into row_out;
  return jsonb_build_object('seg', idx - 1, 'level', lvl, 'pending', lvl - L,
    'reward', jsonb_build_object('kind', coalesce(chest, 'wheel'), 'id', seg, 'level', L, 'pesetas', pes, 'tomatoes', tom, 'cards', won, 'falcon', seg = 'x5', 'falcon_until', fal),
    'profile', to_jsonb(row_out));
end $$;
revoke all on function public.spin_level_wheel() from public, anon;
grant execute on function public.spin_level_wheel() to authenticated;

-- Ranking con el nivel de cada jugador
drop view if exists public.leaderboard;
create view public.leaderboard with (security_invoker = false) as
  select username, tomatoes_earned, falls, perfects, hits, coalesce(avatar, 'espana') as avatar,
    public.fn_player_level(tomatoes_thrown, hits, falls) as level
  from public.profiles where tomatoes_earned > 0
  order by tomatoes_earned desc, falls desc limit 50;
grant select on public.leaderboard to anon, authenticated;

-- ===================================================================== schema_v14.sql
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

-- ===================================================================== schema_v15.sql
-- AL AGUA PEDRO · versión 15 del esquema (ejecutar DESPUÉS de schema_v14.sql; o ejecuta schema_todo.sql, que lo incluye todo).
--  · Paguitas por niveles: hasta el nivel 7 caen más a menudo (120 → 56 s); desde el 8 cada moneda vale más:
--    ×2 (niveles 8–10), ×3 (11–13) y ×4 (14–15). Igual que js/economy.js. El guardado lo tiene en cuenta.
--  · Ruleta legendaria de la tienda: ya NO se vende. Se consigue viendo 3 vídeos (uno de 3 al día como mucho:
--    una tirada legendaria diaria). Sigue tocando gratis en los niveles 10, 20, 30, 40 y 50.
-- Conserva todos los jugadores y su progreso. Se puede ejecutar más de una vez.

create or replace function public.fn_paguitas_every(p_level integer) returns numeric language sql immutable as $$
  select round(120 * power(0.88, least(greatest(p_level, 1), 7) - 1)) $$;
create or replace function public.fn_paguitas_value(p_level integer) returns integer language sql immutable as $$
  select case when p_level < 8 then 1 when p_level < 11 then 2 when p_level < 14 then 3 else 4 end $$;

-- Guardado: igual que en la versión 6, con el nuevo límite de las paguitas
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
  -- Paguitas: como mucho 3 monedas (de lo que valga cada una) por cada intervalo transcurrido desde el último guardado (+2 de margen)
  lvl := public.fn_card_level(cur.cards, 'paguitas');
  if lvl = 0 then v_pag := cur.paguitas_pesetas;
  else every := public.fn_paguitas_every(lvl);
    v_pag := least(greatest(cur.paguitas_pesetas, coalesce(p_paguitas_pesetas, 0)), cur.paguitas_pesetas + 3 * public.fn_paguitas_value(lvl) * (floor(secs / every)::integer + 2)); end if;
  update public.profiles set total_clicks = v_clicks, tomatoes_thrown = v_thrown, hits = v_hits, perfects = v_perf, falls = v_falls, pesetas_earned = v_pes, tomatoes_refunded = v_ref, paguitas_pesetas = v_pag, updated_at = now()
  where user_id = auth.uid() returning * into new_row;
  return new_row;
end $$;
grant execute on function public.save_progress(bigint, integer, integer, integer, integer, integer, integer, integer) to authenticated;
revoke execute on function public.save_progress(bigint, integer, integer, integer, integer, integer, integer, integer) from anon;

-- Vídeos para la ruleta legendaria: cada 3 vídeos, una tirada (como mucho 3 vídeos al día)
alter table public.profiles add column if not exists legend_ads integer not null default 0 check (legend_ads >= 0);
create or replace function public.claim_ad_reward(p_placement text, p_token text) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare cur public.profiles; today text := ((now() at time zone 'Europe/Madrid')::date)::text; claims jsonb; n integer; lim integer; row_out public.profiles;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  if coalesce((select value from public.aap_config where key = 'rewarded_ads'), 'false') <> 'true' then raise exception 'Los anuncios todavía no están disponibles'; end if;
  if p_placement not in ('falcon', 'sobre', 'ruleta') then raise exception 'Esa oferta no existe'; end if;
  select * into cur from public.profiles where user_id = auth.uid() for update;
  if not found then raise exception 'El perfil no existe'; end if;
  claims := case when cur.ad_claims->>'day' = today then cur.ad_claims else jsonb_build_object('day', today) end;
  n := coalesce((claims->>p_placement)::integer, 0);
  lim := case p_placement when 'sobre' then 10 when 'ruleta' then 3 else 6 end;
  if n >= lim then raise exception 'Ya has visto todos los vídeos de hoy para esta oferta. Vuelve mañana'; end if;
  claims := jsonb_set(claims, array[p_placement], to_jsonb(n + 1));
  if p_placement = 'falcon' then
    if cur.falcon_until is not null and cur.falcon_until > now() then raise exception 'El Falcón ya está en marcha'; end if;
    update public.profiles set falcon_until = now() + interval '10 minutes', ad_claims = claims where user_id = auth.uid() returning * into row_out;
  elsif p_placement = 'ruleta' then
    update public.profiles set legend_ads = case when legend_ads + 1 >= 3 then 0 else legend_ads + 1 end,
      legend_spins = legend_spins + case when legend_ads + 1 >= 3 then 1 else 0 end, ad_claims = claims, updated_at = now()
    where user_id = auth.uid() returning * into row_out;
  else
    update public.profiles set chest_pesetas = chest_pesetas + 25, ad_claims = claims, updated_at = now() where user_id = auth.uid() returning * into row_out;
  end if;
  return row_out;
end $$;
revoke all on function public.claim_ad_reward(text, text) from public, anon;
grant execute on function public.claim_ad_reward(text, text) to authenticated;

-- La tirada legendaria ya no se vende con dinero real
create or replace function public.fn_pack(p text) returns jsonb language sql immutable as $$
  select case p
    when 'calderilla' then '{"pesetas": 750, "tomatoes": 300, "cards": 0}'::jsonb
    when 'maletin'    then '{"pesetas": 1750, "tomatoes": 700, "cards": 0}'::jsonb
    when 'camara'     then '{"pesetas": 5000, "tomatoes": 2000, "cards": 4}'::jsonb
  end $$;

-- ===================================================================== schema_v16.sql
-- AL AGUA PEDRO · versión 16 del esquema (ejecutar DESPUÉS de schema_v15.sql; o ejecuta schema_todo.sql, que lo incluye todo).
--  · Comunidad autónoma de cada jugador (sustituye a los títulos del perfil, que ya no se usan).
--  · Ranking por comunidades: tomates de todos sus jugadores, y los mejores de cada comunidad.
--  · La comunidad se elige al entrar; se puede corregir una vez enseguida y luego cambiar una vez por semana.
--  · (La ruleta de la suerte vuelve a costar 40 + 3 por nivel, sin tope: la deja así schema_v14.sql.)
-- Conserva todos los jugadores y su progreso. Se puede ejecutar más de una vez.

alter table public.profiles add column if not exists region text, add column if not exists region_changed_at timestamptz;

-- mismas comunidades (y mismos nombres internos) que las banderas de js/avatars.js
create or replace function public.fn_regions() returns text[] language sql immutable as $$
  select array['andalucia', 'aragon', 'asturias', 'baleares', 'canarias', 'cantabria', 'castilla-la-mancha', 'castilla-y-leon', 'cataluna', 'valencia',
    'extremadura', 'galicia', 'madrid', 'murcia', 'navarra', 'pais-vasco', 'rioja', 'ceuta', 'melilla'] $$;

-- la ruleta de la suerte, sin tope (por si se llegó a ejecutar la versión con tope de 120)
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
revoke all on function public.buy_wheel_spin() from public, anon;
grant execute on function public.buy_wheel_spin() to authenticated;

create or replace function public.set_region(p_region text) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare cur public.profiles; row_out public.profiles;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  if p_region is null or not (p_region = any (public.fn_regions())) then raise exception 'Esa comunidad no existe'; end if;
  select * into cur from public.profiles where user_id = auth.uid() for update;
  if not found then raise exception 'El perfil no existe'; end if;
  if cur.region = p_region then return cur; end if;
  if cur.region is not null and cur.region_changed_at is not null and cur.region_changed_at > now() - interval '7 days' then
    raise exception 'Solo puedes cambiar de comunidad una vez por semana';
  end if;
  -- la primera vez no cuenta (así se puede corregir enseguida); después, una vez por semana. No se toca updated_at.
  update public.profiles set region = p_region, region_changed_at = case when cur.region is null then null else now() end
  where user_id = auth.uid() returning * into row_out;
  return row_out;
end $$;
revoke all on function public.set_region(text) from public, anon;
grant execute on function public.set_region(text) to authenticated;

-- Ranking general, ahora con la comunidad de cada jugador
drop view if exists public.leaderboard;
create view public.leaderboard with (security_invoker = false) as
  select username, tomatoes_earned, falls, perfects, hits, coalesce(avatar, 'espana') as avatar,
    public.fn_player_level(tomatoes_thrown, hits, falls) as level, region
  from public.profiles where tomatoes_earned > 0
  order by tomatoes_earned desc, falls desc limit 50;
grant select on public.leaderboard to anon, authenticated;

-- Ranking de comunidades: suma de tomates de todos sus jugadores
drop view if exists public.region_ranking;
create view public.region_ranking with (security_invoker = false) as
  select region, count(*)::integer as players, sum(tomatoes_earned)::bigint as tomatoes, sum(falls)::bigint as falls
  from public.profiles where region is not null and tomatoes_earned > 0
  group by region order by tomatoes desc;
grant select on public.region_ranking to anon, authenticated;

-- Los 20 mejores de cada comunidad
drop view if exists public.region_leaders;
create view public.region_leaders with (security_invoker = false) as
  select username, avatar, level, tomatoes_earned, falls, region from (
    select username, coalesce(avatar, 'espana') as avatar, public.fn_player_level(tomatoes_thrown, hits, falls) as level, tomatoes_earned, falls, region,
      row_number() over (partition by region order by tomatoes_earned desc, falls desc) as n
    from public.profiles where region is not null and tomatoes_earned > 0) x
  where n <= 20;
grant select on public.region_leaders to anon, authenticated;

-- ===================================================================== schema_v17.sql
-- AL AGUA PEDRO · versión 17 del esquema (ejecutar DESPUÉS de schema_v16.sql; o ejecuta schema_todo.sql, que lo incluye todo).
--  · Racha de lanzamientos: tirar a Pedro al agua varias veces seguidas da pesetas extra (columna streak_pesetas).
--    Cada guardado admite como mucho 45 por caída nueva y, en total, 15 por caída; js/streak.js da bastante menos.
--  · Las pesetas disponibles cuentan también las de las rachas.
-- Conserva todos los jugadores y su progreso. Se puede ejecutar más de una vez.

alter table public.profiles add column if not exists streak_pesetas integer not null default 0 check (streak_pesetas >= 0);
alter table public.profiles drop column if exists pesetas;
alter table public.profiles add column pesetas integer generated always as (pesetas_earned + chest_pesetas + paguitas_pesetas + streak_pesetas - pesetas_spent) stored;

-- Guardado: igual que en la versión 15, con las pesetas de las rachas
drop function if exists public.save_progress(bigint, integer, integer, integer, integer, integer, integer, integer);
create or replace function public.save_progress(p_total_clicks bigint, p_tomatoes_thrown integer, p_hits integer, p_perfects integer, p_falls integer, p_pesetas_earned integer, p_tomatoes_refunded integer default 0, p_paguitas_pesetas integer default 0, p_streak_pesetas integer default 0)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare cur public.profiles; new_row public.profiles; secs numeric; max_clicks bigint; v_clicks bigint; v_thrown integer; v_hits integer; v_perf integer; v_falls integer; v_pes integer; v_ref integer; v_pag integer; v_str integer; lvl integer; every numeric;
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
  -- Paguitas: como mucho 3 monedas (de lo que valga cada una) por cada intervalo transcurrido desde el último guardado (+2 de margen)
  lvl := public.fn_card_level(cur.cards, 'paguitas');
  if lvl = 0 then v_pag := cur.paguitas_pesetas;
  else every := public.fn_paguitas_every(lvl);
    v_pag := least(greatest(cur.paguitas_pesetas, coalesce(p_paguitas_pesetas, 0)), cur.paguitas_pesetas + 3 * public.fn_paguitas_value(lvl) * (floor(secs / every)::integer + 2)); end if;
  -- Racha de lanzamientos: pesetas extra. Como mucho 45 por cada caída nueva de este guardado (lo más que da un acierto con premio)
  -- y, en total, 15 por caída de toda la partida (de media da menos de 8)
  v_str := greatest(cur.streak_pesetas, least(coalesce(p_streak_pesetas, 0), cur.streak_pesetas + 45 * greatest(0, v_falls - cur.falls), 15 * v_falls));
  update public.profiles set streak_pesetas = v_str, total_clicks = v_clicks, tomatoes_thrown = v_thrown, hits = v_hits, perfects = v_perf, falls = v_falls, pesetas_earned = v_pes, tomatoes_refunded = v_ref, paguitas_pesetas = v_pag, updated_at = now()
  where user_id = auth.uid() returning * into new_row;
  return new_row;
end $$;
grant execute on function public.save_progress(bigint, integer, integer, integer, integer, integer, integer, integer, integer) to authenticated;
revoke execute on function public.save_progress(bigint, integer, integer, integer, integer, integer, integer, integer, integer) from anon;

-- ===================================================================== schema_v18.sql
-- AL AGUA PEDRO · versión 18 del esquema (ejecutar DESPUÉS de schema_v17.sql; o ejecuta schema_todo.sql, que lo incluye todo).
--  · Los primeros niveles cuestan algo más (nivel 2: 300 XP; 3: 800; 4: 1.500; 5: 2.400; 6: 3.500; 7: 4.800; 8: 6.400; 9: 8.300).
--    Del nivel 10 en adelante no cambia nada. Igual que XP_AT en js/levels.js.
--  · La ruleta normal da algo menos de tomates (8 + 2 por nivel y 20 + 6 por nivel), para que no encadene niveles al empezar.
-- Las tiradas ya giradas no se pierden. Conserva todos los jugadores y su progreso. Se puede ejecutar más de una vez.

create or replace function public.fn_level_of_xp(p_xp bigint) returns integer language sql immutable as $$
  select 1 + count(*)::integer from unnest(array[300, 800, 1500, 2400, 3500, 4800, 6400, 8300, 10560, 13720, 17410, 21660, 26510, 31990, 38120, 44940, 52470, 60750,
    69800, 79640, 90310, 101820, 114210, 127500, 141710, 156870, 173000, 190130, 208280, 227470, 247720, 269060, 291510, 315090, 339830, 365740, 392850, 421180,
    450750, 481580, 513690, 547100, 581830, 617900, 655330, 694140, 734350, 775990, 819060]::bigint[]) t where p_xp >= t $$;
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
    when 'pes_s' then pes := 10 + 2 * L;      when 'tom_s' then tom := 8 + 2 * L;
    when 'pes_m' then pes := 30 + 5 * L;      when 'tom_l' then tom := 20 + 6 * L;
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

-- ===================================================================== schema_v19.sql
-- AL AGUA PEDRO · versión 19 del esquema (ejecutar DESPUÉS de schema_v18.sql; o ejecuta schema_todo.sql, que lo incluye todo).
--  · Paguitas: con la carta, caen siempre 3 monedas cada 75 segundos; lo que suman sube en todos los niveles (de 3 a 24 pesetas).
--  · Carta nueva «Chantaje Pegasus» (épica, 20 niveles): probabilidad de no perder la racha al fallar. Sale en los cofres como
--    las demás épicas y se mejora igual (igual que js/economy.js).
-- Conserva todos los jugadores y su progreso. Se puede ejecutar más de una vez.

-- Paguitas (el guardado usa estas dos funciones para limitar las pesetas)
create or replace function public.fn_paguitas_every(p_level integer) returns numeric language sql immutable as $$ select 75::numeric $$;
create or replace function public.fn_paguitas_total(p_level integer) returns integer language sql immutable as $$
  select (array[3, 4, 5, 6, 8, 9, 10, 12, 14, 15, 16, 18, 20, 21, 24])[least(greatest(p_level, 1), 15)] $$;
-- lo que vale la moneda más alta de cada lluvia (el guardado admite 3 × esto por lluvia)
create or replace function public.fn_paguitas_value(p_level integer) returns integer language sql immutable as $$
  select ceil(public.fn_paguitas_total(p_level) / 3.0)::integer $$;

-- Chantaje Pegasus
create or replace function public.fn_rarity(p_id text) returns text language sql immutable as $$
  select case p_id
    when 'inflacion' then 'legendary' when 'joyas' then 'legendary'
    when 'hacienda' then 'epic' when 'paguitas' then 'epic' when 'pegasus' then 'epic'
    when 'mariscada' then 'rare'
    when 'puerta' then 'common' when 'plusultra' then 'common' when 'apagon' then 'common' when 'amnistia' then 'common' end $$;
create or replace function public.fn_rarity_cards(p_rarity text) returns text[] language sql immutable as $$
  select case p_rarity when 'common' then array['puerta', 'plusultra', 'apagon', 'amnistia'] when 'rare' then array['mariscada']
    when 'epic' then array['hacienda', 'paguitas', 'pegasus'] else array['inflacion', 'joyas'] end $$;
create or replace function public.fn_max_level(p_id text) returns integer language sql immutable as $$
  select case p_id when 'inflacion' then 30 when 'joyas' then 25 when 'apagon' then 25 when 'mariscada' then 25 when 'amnistia' then 20
    when 'plusultra' then 25 when 'hacienda' then 20 when 'puerta' then 20 when 'paguitas' then 15 when 'pegasus' then 20 end $$;

-- todos los jugadores tienen la carta nueva (a nivel 0); los nuevos también
update public.profiles set cards = cards || '{"pegasus": {"level": 0, "frags": 0}}'::jsonb where not (cards ? 'pegasus');
alter table public.profiles alter column cards set default '{"inflacion":{"level":0,"frags":0},"joyas":{"level":0,"frags":0},"mariscada":{"level":0,"frags":0},"apagon":{"level":0,"frags":0},"amnistia":{"level":0,"frags":0},"plusultra":{"level":0,"frags":0},"hacienda":{"level":0,"frags":0},"puerta":{"level":0,"frags":0},"paguitas":{"level":0,"frags":0},"pegasus":{"level":0,"frags":0}}'::jsonb;

-- Mejorar cartas (igual que en la versión 6, con la carta nueva)
create or replace function public.upgrade_card(p_card text) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare cur public.profiles; lvl integer; cost integer; need integer; row_out public.profiles; back integer; toms integer;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if p_card not in ('inflacion', 'joyas', 'mariscada', 'apagon', 'amnistia', 'plusultra', 'hacienda', 'puerta', 'paguitas', 'pegasus') then raise exception 'Carta desconocida'; end if;
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
revoke all on function public.upgrade_card(text) from public, anon;
grant execute on function public.upgrade_card(text) to authenticated;

-- ===================================================================== schema_v20.sql
-- AL AGUA PEDRO · versión 20 del esquema (ejecutar DESPUÉS de schema_v19.sql; o ejecuta schema_todo.sql, que lo incluye todo).
--  · El Falcón (×5 clics) dura 2 minutos: el de la tienda (vídeo) y el de las ruletas (normal y legendaria).
--  · Paguitas: cada nivel de la carta suma 3 pesetas por lluvia (nivel 1: 3; nivel 2: 6; nivel 3: 9... nivel 15: 45),
--    es decir, cada una de las 3 monedas vale el nivel de la carta. Igual que js/economy.js.
-- Conserva todos los jugadores y su progreso. Se puede ejecutar más de una vez.

create or replace function public.fn_paguitas_total(p_level integer) returns integer language sql immutable as $$
  select 3 * least(greatest(p_level, 1), 15) $$;
create or replace function public.fn_paguitas_value(p_level integer) returns integer language sql immutable as $$
  select least(greatest(p_level, 1), 15) $$;

create or replace function public.claim_ad_reward(p_placement text, p_token text) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare cur public.profiles; today text := ((now() at time zone 'Europe/Madrid')::date)::text; claims jsonb; n integer; lim integer; row_out public.profiles;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  if coalesce((select value from public.aap_config where key = 'rewarded_ads'), 'false') <> 'true' then raise exception 'Los anuncios todavía no están disponibles'; end if;
  if p_placement not in ('falcon', 'sobre', 'ruleta') then raise exception 'Esa oferta no existe'; end if;
  select * into cur from public.profiles where user_id = auth.uid() for update;
  if not found then raise exception 'El perfil no existe'; end if;
  claims := case when cur.ad_claims->>'day' = today then cur.ad_claims else jsonb_build_object('day', today) end;
  n := coalesce((claims->>p_placement)::integer, 0);
  lim := case p_placement when 'sobre' then 10 when 'ruleta' then 3 else 6 end;
  if n >= lim then raise exception 'Ya has visto todos los vídeos de hoy para esta oferta. Vuelve mañana'; end if;
  claims := jsonb_set(claims, array[p_placement], to_jsonb(n + 1));
  if p_placement = 'falcon' then
    if cur.falcon_until is not null and cur.falcon_until > now() then raise exception 'El Falcón ya está en marcha'; end if;
    update public.profiles set falcon_until = now() + interval '2 minutes', ad_claims = claims where user_id = auth.uid() returning * into row_out;
  elsif p_placement = 'ruleta' then
    update public.profiles set legend_ads = case when legend_ads + 1 >= 3 then 0 else legend_ads + 1 end,
      legend_spins = legend_spins + case when legend_ads + 1 >= 3 then 1 else 0 end, ad_claims = claims, updated_at = now()
    where user_id = auth.uid() returning * into row_out;
  else
    update public.profiles set chest_pesetas = chest_pesetas + 25, ad_claims = claims, updated_at = now() where user_id = auth.uid() returning * into row_out;
  end if;
  return row_out;
end $$;
revoke all on function public.claim_ad_reward(text, text) from public, anon;
grant execute on function public.claim_ad_reward(text, text) to authenticated;

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
    when 'pes_s' then pes := 10 + 2 * L;      when 'tom_s' then tom := 8 + 2 * L;
    when 'pes_m' then pes := 30 + 5 * L;      when 'tom_l' then tom := 20 + 6 * L;
    when 'jackpot' then pes := 100 + 20 * L;  when 'x5' then mins := 2;
    when 'card' then chest := 'wood';         when 'cards3' then chest := 'diamond';
    when 'l_pes' then pes := 300 + 10 * L;    when 'l_tom' then tom := 250 + 10 * L;
    when 'l_pesx' then pes := 800 + 20 * L;   when 'l_tomx' then tom := 800 + 20 * L;
    when 'l_bote' then pes := 2500 + 50 * L;  when 'l_x5' then mins := 2;
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

-- ===================================================================== schema_v21.sql
-- AL AGUA PEDRO · versión 21 del esquema (ejecutar DESPUÉS de schema_v20.sql; o ejecuta schema_todo.sql, que lo incluye todo).
--  · Los niveles altos cuestan bastante más: del nivel 10 en adelante, subir del k al k+1 cuesta 12,6·k^2,4 XP.
--    Llegar al 50 pasa de unos 819.000 XP a unos 2,1 millones. Los niveles 1 a 10 no cambian. Igual que XP_AT en js/levels.js.
--  · Quien baje de nivel no pierde nada y vuelve a tener ruleta al subir el siguiente nivel.
-- Conserva todos los jugadores y su progreso. Se puede ejecutar más de una vez.

create or replace function public.fn_level_of_xp(p_xp bigint) returns integer language sql immutable as $$
  select 1 + count(*)::integer from unnest(array[300, 800, 1500, 2400, 3500, 4800, 6400, 8300, 10560, 13720, 17700, 22600, 28540, 35640, 44020, 53800, 65110, 78080, 92850, 109550, 128330, 149330, 172690, 198560, 227100, 258450, 292780, 330240, 370990, 415190, 463010, 514620, 570190, 629880, 693870, 762340, 835460, 913420, 996390, 1084560, 1178110, 1277230, 1382110, 1492940, 1609910, 1733220, 1863060, 1999630, 2143130]::bigint[]) t where p_xp >= t $$;

-- quien queda en un nivel más bajo que su última ruleta: la siguiente subida vuelve a dar ruleta
update public.profiles set wheel_level = greatest(1, public.fn_player_level(tomatoes_thrown, hits, falls))
where wheel_level > public.fn_player_level(tomatoes_thrown, hits, falls);

commit;
