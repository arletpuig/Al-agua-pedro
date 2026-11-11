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
