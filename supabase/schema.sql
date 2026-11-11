-- AL AGUA PEDRO · esquema de base de datos para Supabase.
-- Pega este archivo completo en: Supabase > SQL Editor > New query > Run.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null default 'Jugador',
  total_clicks bigint not null default 0 check (total_clicks >= 0),
  tomatoes_thrown integer not null default 0 check (tomatoes_thrown >= 0),
  hits integer not null default 0 check (hits >= 0),
  falls integer not null default 0 check (falls >= 0),
  -- valores derivados (100 clics = 1 tomate; debe coincidir con CLICKS_PER_TOMATO en js/config.js)
  tomatoes_earned integer generated always as ((total_clicks / 100)::integer) stored,
  clicks_progress integer generated always as ((total_clicks % 100)::integer) stored,
  tomatoes integer generated always as ((total_clicks / 100)::integer - tomatoes_thrown) stored,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Cada usuario solo puede leer su propia fila. Las escrituras pasan SIEMPRE por save_progress().
drop policy if exists "leer propio perfil" on public.profiles;
create policy "leer propio perfil" on public.profiles for select to authenticated using (auth.uid() = user_id);
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

-- Crea el perfil automáticamente al registrarse.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, username)
  values (new.id, coalesce(left(nullif(trim(new.raw_user_meta_data->>'username'), ''), 20), 'Jugador'))
  on conflict (user_id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Guardado validado en el servidor: no confía en el navegador.
create or replace function public.save_progress(p_total_clicks bigint, p_tomatoes_thrown integer, p_hits integer, p_falls integer)
returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  cur public.profiles; new_row public.profiles;
  secs numeric; max_clicks bigint; v_clicks bigint; v_thrown integer; v_hits integer; v_falls integer;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select * into cur from public.profiles where user_id = auth.uid() for update;
  if not found then
    insert into public.profiles (user_id) values (auth.uid()) returning * into cur;
  end if;
  -- los totales nunca bajan
  v_clicks := greatest(cur.total_clicks, coalesce(p_total_clicks, 0));
  -- límite contra automatizaciones: máx. 25 clics/segundo desde el último guardado (+600 de margen)
  secs := extract(epoch from (now() - cur.updated_at));
  max_clicks := cur.total_clicks + 600 + floor(secs * 25)::bigint;
  v_clicks := least(v_clicks, max_clicks);
  -- no se pueden lanzar más tomates de los conseguidos
  v_thrown := least(greatest(cur.tomatoes_thrown, coalesce(p_tomatoes_thrown, 0)), (v_clicks / 100)::integer);
  v_hits := least(greatest(cur.hits, coalesce(p_hits, 0)), v_thrown);
  v_falls := least(greatest(cur.falls, coalesce(p_falls, 0)), v_hits);
  update public.profiles set total_clicks = v_clicks, tomatoes_thrown = v_thrown, hits = v_hits, falls = v_falls, updated_at = now()
  where user_id = auth.uid() returning * into new_row;
  return new_row;
end $$;
grant execute on function public.save_progress(bigint, integer, integer, integer) to authenticated;
revoke execute on function public.save_progress(bigint, integer, integer, integer) from anon;

-- Ranking público (solo nombre y estadísticas, nunca correos).
create or replace view public.leaderboard with (security_invoker = false) as
  select username, falls, hits, tomatoes_thrown, total_clicks
  from public.profiles where falls > 0 or hits > 0
  order by falls desc, hits desc limit 50;
grant select on public.leaderboard to anon, authenticated;
