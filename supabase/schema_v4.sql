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
