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
