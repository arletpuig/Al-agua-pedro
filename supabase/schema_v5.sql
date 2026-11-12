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
