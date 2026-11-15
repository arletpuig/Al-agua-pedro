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
