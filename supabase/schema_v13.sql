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
