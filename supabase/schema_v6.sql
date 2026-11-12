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
