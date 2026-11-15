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
