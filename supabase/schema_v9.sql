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
