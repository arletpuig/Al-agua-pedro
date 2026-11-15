-- AL AGUA PEDRO · versión 16 del esquema (ejecutar DESPUÉS de schema_v15.sql; o ejecuta schema_todo.sql, que lo incluye todo).
--  · Ruleta de la suerte de la tienda: el precio sube con el nivel (40 + 3 por nivel) pero nunca pasa de 120 pesetas.
-- Conserva todos los jugadores y su progreso. Se puede ejecutar más de una vez.

-- Ruleta de la tienda, pagando pesetas: 40 + 3 por nivel, como mucho 120 (siempre más pesetas de las que da de media)
create or replace function public.buy_wheel_spin() returns jsonb
language plpgsql security definer set search_path = public as $$
declare cur public.profiles; lvl integer; cost integer;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  select * into cur from public.profiles where user_id = auth.uid() for update;
  if not found then raise exception 'El perfil no existe'; end if;
  lvl := public.fn_player_level(cur.tomatoes_thrown, cur.hits, cur.falls);
  cost := least(120, 40 + 3 * lvl);
  if cur.pesetas < cost then raise exception 'No tienes pesetas suficientes'; end if;
  return public.fn_wheel_grant(auth.uid(), 'normal', lvl, cost, null, 0);
end $$;

revoke all on function public.buy_wheel_spin() from public, anon;
grant execute on function public.buy_wheel_spin() to authenticated;
