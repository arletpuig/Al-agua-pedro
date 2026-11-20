-- AL AGUA PEDRO · versión 30 del esquema (ejecutar DESPUÉS de schema_v29.sql; o ejecuta schema_todo.sql, que lo incluye todo).
--  · Pulsaciones de verdad: nuevo contador «taps» (cada vez que tocas ¡DALE! con el dedo, sin multiplicar por
--    Inflación, Falcón ni racha). Lo guarda save_progress, con su propio tope contra automatizaciones (25 por segundo).
--  · Logros diarios más difíciles y según el nivel: los objetivos crecen con el nivel que tenías al empezar el día.
--    La misión de clics pasa a ser de pulsaciones («Pulsa ¡DALE! N veces»).
--  · La Armería se abre en el nivel 50 (el máximo): desde ahí se compran los objetos. Lo que ya tenías se queda.
--  · El martillo de goma (regalo de la app) se entrega al llegar al nivel 50, cuando se abre La Armería.
--  · Avisos (notificaciones push): suscripciones de cada móvil y qué aviso toca a cada hora (cofre diario y recordatorio).
-- Conserva todos los jugadores y su progreso. Se puede ejecutar más de una vez.

-- ============================================================ pulsaciones
alter table public.profiles add column if not exists taps bigint not null default 0;

drop function if exists public.save_progress(bigint, integer, integer, integer, integer, integer, integer, integer, integer);
create or replace function public.save_progress(p_total_clicks bigint, p_tomatoes_thrown integer, p_hits integer, p_perfects integer, p_falls integer, p_pesetas_earned integer, p_tomatoes_refunded integer default 0, p_paguitas_pesetas integer default 0, p_streak_pesetas integer default 0, p_taps bigint default null)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare cpt integer; cur public.profiles; new_row public.profiles; secs numeric; max_clicks bigint; v_clicks bigint; v_thrown integer; v_hits integer; v_perf integer; v_falls integer; v_pes integer; v_ref integer; v_pag integer; v_str integer; v_taps bigint; lvl integer; every numeric;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select * into cur from public.profiles where user_id = auth.uid() for update;
  if not found then insert into public.profiles (user_id) values (auth.uid()) returning * into cur; end if;
  v_clicks := greatest(cur.total_clicks, coalesce(p_total_clicks, 0));
  -- límite contra automatizaciones: máx. 25 pulsaciones/segundo con la racha ×3 (75 por los clics de cada pulsación) desde el último guardado, +1800 de margen
  secs := extract(epoch from (now() - cur.updated_at));
  -- con el Falcón: cuenta ×5 si ha estado en marcha en algún momento desde el último guardado (aunque ya haya terminado al guardar)
  cpt := (1 + public.fn_card_level(cur.cards, 'inflacion')) * case when cur.falcon_until is not null and cur.falcon_until > cur.updated_at - interval '10 seconds' then 5 else 1 end;
  max_clicks := cur.total_clicks + 1800 * cpt + floor(secs * 75 * cpt)::bigint;
  v_clicks := least(v_clicks, max_clicks);
  -- pulsaciones con el dedo: como mucho 25 por segundo (+600 de margen) y nunca más que los clics nuevos
  v_taps := least(greatest(cur.taps, coalesce(p_taps, cur.taps)), cur.taps + 600 + floor(secs * 25)::bigint, cur.taps + (v_clicks - cur.total_clicks));
  v_ref := greatest(cur.tomatoes_refunded, coalesce(p_tomatoes_refunded, 0));
  v_thrown := least(greatest(cur.tomatoes_thrown, coalesce(p_tomatoes_thrown, 0)), cur.legacy_tomatoes + ((v_clicks - cur.legacy_clicks) / 200)::integer + cur.chest_tomatoes + v_ref);
  v_hits := least(greatest(cur.hits, coalesce(p_hits, 0)), v_thrown);
  v_perf := least(greatest(cur.perfects, coalesce(p_perfects, 0)), v_hits);
  v_falls := least(greatest(cur.falls, coalesce(p_falls, 0)), v_hits);
  v_pes := least(greatest(cur.pesetas_earned, coalesce(p_pesetas_earned, 0)), v_falls * 3);
  -- Plus Ultra: solo se recuperan tomates de lanzamientos fallados
  v_ref := least(v_ref, greatest(cur.tomatoes_refunded, v_thrown - v_hits));
  -- Paguitas: como mucho 3 monedas (de lo que valga cada una) por cada intervalo transcurrido desde el último guardado (+2 de margen)
  lvl := public.fn_card_level(cur.cards, 'paguitas');
  if lvl = 0 then v_pag := cur.paguitas_pesetas;
  else every := public.fn_paguitas_every(lvl);
    v_pag := least(greatest(cur.paguitas_pesetas, coalesce(p_paguitas_pesetas, 0)), cur.paguitas_pesetas + 3 * public.fn_paguitas_value(lvl) * (floor(secs / every)::integer + 2)); end if;
  -- Racha de lanzamientos: pesetas extra. Como mucho 45 por cada caída nueva de este guardado y, en total, 15 por caída
  v_str := greatest(cur.streak_pesetas, least(coalesce(p_streak_pesetas, 0), cur.streak_pesetas + 45 * greatest(0, v_falls - cur.falls), 15 * v_falls));
  update public.profiles set streak_pesetas = v_str, total_clicks = v_clicks, taps = v_taps, tomatoes_thrown = v_thrown, hits = v_hits, perfects = v_perf, falls = v_falls, pesetas_earned = v_pes, tomatoes_refunded = v_ref, paguitas_pesetas = v_pag, updated_at = now()
  where user_id = auth.uid() returning * into new_row;
  return new_row;
end $$;
revoke execute on function public.save_progress(bigint, integer, integer, integer, integer, integer, integer, integer, integer, bigint) from public, anon;
grant execute on function public.save_progress(bigint, integer, integer, integer, integer, integer, integer, integer, integer, bigint) to authenticated;

-- ============================================================ logros diarios según el nivel (igual que js/daily-rules.js)
-- t = tomates tirados, f = caídas, k = pulsaciones, h = impactos, p = perfectos, o = cofres
create or replace function public.fn_daily_pool(p_slot integer) returns jsonb language sql immutable as $$
  select case p_slot
    when 0 then '[["e_tom",  "t", 25], ["e_fall", "f", 5],  ["e_tap", "k", 500],  ["e_hit",  "h", 15]]'::jsonb
    when 1 then '[["m_tom",  "t", 60], ["m_fall", "f", 15], ["m_tap",  "k", 1500], ["m_perf", "p", 10]]'::jsonb
    else        '[["h_fall", "f", 40], ["h_tom",  "t", 150], ["h_perf", "p", 30],  ["h_chest", "o", 4]]'::jsonb end $$;
-- objetivo según el nivel: +6 % por nivel (nivel 1 = la base; nivel 46 = ×3,7), redondeado a una cifra «bonita». Cofres: +1 cada 10 niveles
create or replace function public.fn_daily_goal(p_base integer, p_k text, p_level integer) returns integer language sql immutable as $$
  select case when p_k = 'o' then p_base + (least(greatest(p_level, 1), 50) - 1) / 10
    else (select ((n + s * 50) / (s * 100)) * s from (select n, case when n < 5000 then 1 when n < 20000 then 5 when n < 100000 then 10 else 50 end as s
      from (select p_base * (100 + 6 * (least(greatest(p_level, 1), 50) - 1)) as n) a) b) end $$;
drop function if exists public.fn_daily_mission(date, integer);
create or replace function public.fn_daily_mission(p_day date, p_slot integer, p_level integer) returns jsonb language sql immutable as $$
  select jsonb_build_array(m->>0, m->>1, public.fn_daily_goal((m->>2)::integer, m->>1, p_level))
  from (select public.fn_daily_pool(p_slot) -> (((p_day - date '2026-01-01') * (case p_slot when 0 then 1 when 1 then 3 else 5 end) + p_slot) % 4) as m) x $$;
create or replace function public.fn_daily_count(p public.profiles, k text) returns bigint language sql immutable as $$
  select case k when 't' then p.tomatoes_thrown::bigint when 'f' then p.falls::bigint when 'k' then p.taps when 'c' then p.total_clicks when 'h' then p.hits::bigint
    when 'p' then p.perfects::bigint when 'o' then p.chests_opened::bigint else 0 end $$;
-- el estado de hoy: al cambiar el día se apuntan los contadores y el nivel de ahora (los objetivos de hoy ya no cambian)
create or replace function public.fn_daily_today(p public.profiles) returns jsonb language sql stable as $$
  select case
    when coalesce(p.daily->>'date', '') = ((now() at time zone 'Europe/Madrid')::date)::text and p.daily ? 'lv' then p.daily
    when coalesce(p.daily->>'date', '') = ((now() at time zone 'Europe/Madrid')::date)::text      -- día empezado con la versión anterior
      then p.daily || jsonb_build_object('lv', least(50, public.fn_player_level(p.tomatoes_thrown, p.hits, p.falls)), 'base', coalesce(p.daily->'base', '{}'::jsonb) || jsonb_build_object('k', p.taps))
    else jsonb_build_object('date', ((now() at time zone 'Europe/Madrid')::date)::text, 'lv', least(50, public.fn_player_level(p.tomatoes_thrown, p.hits, p.falls)),
      'base', jsonb_build_object('t', p.tomatoes_thrown, 'f', p.falls, 'k', p.taps, 'h', p.hits, 'p', p.perfects, 'o', p.chests_opened),
      'done', '[]'::jsonb, 'bonus', false, 'login_date', p.daily->'login_date', 'login_streak', coalesce(p.daily->'login_streak', '0'::jsonb)) end $$;

create or replace function public.claim_daily_mission(p_slot integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cur public.profiles; row_out public.profiles; d jsonb; m jsonb; lvl integer; rw jsonb; prog bigint;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  if p_slot is null or p_slot not between 0 and 2 then raise exception 'Esa misión no existe'; end if;
  select * into cur from public.profiles where user_id = auth.uid() for update;
  if not found then raise exception 'El perfil no existe'; end if;
  d := public.fn_daily_today(cur);
  if (d->'done') ? p_slot::text then raise exception 'Ya has recogido esa misión'; end if;
  m := public.fn_daily_mission((d->>'date')::date, p_slot, (d->>'lv')::integer);
  prog := public.fn_daily_count(cur, m->>1) - coalesce((d->'base'->>(m->>1))::bigint, 0);
  if prog < (m->>2)::bigint then raise exception 'Todavía no has completado esa misión'; end if;
  lvl := least(50, public.fn_player_level(cur.tomatoes_thrown, cur.hits, cur.falls));
  rw := public.fn_daily_reward(p_slot, lvl);
  d := jsonb_set(d, '{done}', (d->'done') || to_jsonb(p_slot::text));
  update public.profiles set daily = d, chest_tomatoes = chest_tomatoes + (rw->>'tomatoes')::integer, chest_pesetas = chest_pesetas + (rw->>'pesetas')::integer, updated_at = now()
  where user_id = auth.uid() returning * into row_out;
  return jsonb_build_object('reward', rw, 'profile', to_jsonb(row_out));
end $$;
revoke all on function public.claim_daily_mission(integer) from public, anon;
grant execute on function public.claim_daily_mission(integer) to authenticated;

-- ============================================================ La Armería: desde el nivel 50
create or replace function public.buy_armory_item(p_item text) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare cur public.profiles; row_out public.profiles; price integer := public.fn_armory_price(p_item);
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  select * into cur from public.profiles where user_id = auth.uid() for update;
  if not found then raise exception 'El perfil no existe'; end if;
  if price is null then raise exception 'Ese objeto no se vende'; end if;
  if public.fn_player_level(cur.tomatoes_thrown, cur.hits, cur.falls) < 50 then raise exception 'La Armería se desbloquea en el nivel 50'; end if;
  if cur.armory ? p_item then raise exception 'Ya tienes ese objeto'; end if;
  if cur.pesetas < price then raise exception 'No tienes pesetas suficientes'; end if;
  update public.profiles set pesetas_spent = pesetas_spent + price, armory = armory || to_jsonb(p_item), updated_at = now()
  where user_id = auth.uid() returning * into row_out;
  return row_out;
end $$;
revoke all on function public.buy_armory_item(text) from public, anon;
grant execute on function public.buy_armory_item(text) to authenticated;

-- ============================================================ martillo de goma: al llegar al nivel 50
create or replace function public.claim_install_reward() returns jsonb
language plpgsql security definer set search_path = public as $$
declare cur public.profiles; row_out public.profiles; roll jsonb; rw jsonb; hammer boolean;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  select * into cur from public.profiles where user_id = auth.uid() for update;
  if not found then raise exception 'El perfil no existe'; end if;
  if cur.install_claimed then raise exception 'Ya has recogido el regalo de la app'; end if;
  hammer := public.fn_player_level(cur.tomatoes_thrown, cur.hits, cur.falls) >= 50;   -- antes del nivel 50, el martillo espera a que se abra La Armería
  roll := public.fn_roll_chest('diamond', cur.cards);
  rw := jsonb_set(roll->'reward', '{pesetas}', to_jsonb(coalesce((roll->'reward'->>'pesetas')::integer, 0) + 150));
  rw := rw || jsonb_build_object('item', case when hammer then 'hammer' end, 'hammer_at', 50);
  update public.profiles set cards = roll->'cards', chest_tomatoes = chest_tomatoes + coalesce((rw->>'tomatoes')::integer, 0),
    chest_pesetas = chest_pesetas + (rw->>'pesetas')::integer, chests_opened = chests_opened + 1, install_claimed = true,
    armory = case when not hammer or armory ? 'hammer' then armory else armory || '["hammer"]'::jsonb end, updated_at = now()
  where user_id = auth.uid() returning * into row_out;
  return jsonb_build_object('reward', rw, 'profile', to_jsonb(row_out));
end $$;
revoke all on function public.claim_install_reward() from public, anon;
grant execute on function public.claim_install_reward() to authenticated;

-- con la app y ya en el nivel 50: el martillo pasa a La Armería
create or replace function public.claim_app_hammer() returns public.profiles
language plpgsql security definer set search_path = public as $$
declare cur public.profiles; row_out public.profiles;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  select * into cur from public.profiles where user_id = auth.uid() for update;
  if not found then raise exception 'El perfil no existe'; end if;
  if not cur.install_claimed then raise exception 'El martillo es el regalo de la app: instálala para conseguirlo'; end if;
  if cur.armory ? 'hammer' then raise exception 'Ya tienes el martillo'; end if;
  if public.fn_player_level(cur.tomatoes_thrown, cur.hits, cur.falls) < 50 then raise exception 'La Armería se desbloquea en el nivel 50'; end if;
  update public.profiles set armory = armory || '["hammer"]'::jsonb, updated_at = now() where user_id = auth.uid() returning * into row_out;
  return row_out;
end $$;
revoke all on function public.claim_app_hammer() from public, anon;
grant execute on function public.claim_app_hammer() to authenticated;

-- ============================================================ avisos (notificaciones push)
-- Cada móvil o navegador que acepta los avisos guarda aquí su suscripción. Nadie la lee desde el juego: solo la función «avisos».
create table if not exists public.push_subs (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  sent_chest date,          -- último día que se avisó del cofre diario
  sent_play date            -- último día que se recordó jugar
);
create index if not exists push_subs_user on public.push_subs (user_id);
alter table public.push_subs enable row level security;
revoke all on public.push_subs from anon, authenticated;

-- claves para firmar los avisos (las crea la función «avisos» la primera vez; la privada no sale nunca del servidor)
create table if not exists public.push_config (
  id integer primary key default 1 check (id = 1),
  vapid_public text, vapid_private text,
  cron_key text not null default md5(random()::text || clock_timestamp()::text) || md5(random()::text || clock_timestamp()::text)
);
insert into public.push_config (id) values (1) on conflict (id) do nothing;
alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;

-- la clave pública (la necesita el navegador para suscribirse)
create or replace function public.push_public_key() returns text language sql stable security definer set search_path = public as $$
  select vapid_public from public.push_config where id = 1 $$;
grant execute on function public.push_public_key() to anon, authenticated;

create or replace function public.save_push_sub(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  if p_endpoint !~ '^https://' or length(p_endpoint) > 1000 or length(coalesce(p_p256dh, '')) not between 40 and 200 or length(coalesce(p_auth, '')) not between 10 and 100 then
    raise exception 'Esa suscripción no es válida'; end if;
  insert into public.push_subs (endpoint, user_id, p256dh, auth) values (p_endpoint, auth.uid(), p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth;
  -- como mucho 5 aparatos por jugador (los más nuevos)
  delete from public.push_subs where user_id = auth.uid() and endpoint not in (select endpoint from public.push_subs where user_id = auth.uid() order by created_at desc limit 5);
end $$;
create or replace function public.delete_push_sub(p_endpoint text) returns void language sql security definer set search_path = public as $$
  delete from public.push_subs where endpoint = p_endpoint and user_id = auth.uid() $$;
revoke all on function public.save_push_sub(text, text, text), public.delete_push_sub(text) from public, anon;
grant execute on function public.save_push_sub(text, text, text), public.delete_push_sub(text) to authenticated;

-- qué avisos tocan ahora (hora de España): a las 10, el cofre diario a quien aún no lo ha abierto hoy;
-- a las 19, el recordatorio a quien no ha jugado hoy. Una vez al día cada uno. Solo la función «avisos» (con la clave de servicio).
create or replace function public.push_due(p_hour integer default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare h integer := coalesce(p_hour, extract(hour from now() at time zone 'Europe/Madrid')::integer); today date := (now() at time zone 'Europe/Madrid')::date; out jsonb;
begin
  if h = 10 then
    with s as (update public.push_subs ps set sent_chest = today from public.profiles p
               where p.user_id = ps.user_id and ps.sent_chest is distinct from today and (p.daily_claimed_on is null or p.daily_claimed_on < today)
               returning ps.endpoint, ps.p256dh, ps.auth, p.username)
    select coalesce(jsonb_agg(jsonb_build_object('endpoint', endpoint, 'p256dh', p256dh, 'auth', auth, 'kind', 'chest', 'name', username)), '[]') into out from s;
  elsif h = 19 then
    with s as (update public.push_subs ps set sent_play = today from public.profiles p
               where p.user_id = ps.user_id and ps.sent_play is distinct from today and (p.updated_at at time zone 'Europe/Madrid')::date < today
               returning ps.endpoint, ps.p256dh, ps.auth, p.username, coalesce((p.daily->>'login_streak')::integer, 0) as streak,
                 (p.daily->>'login_date') = (today - 1)::text as streak_alive)
    select coalesce(jsonb_agg(jsonb_build_object('endpoint', endpoint, 'p256dh', p256dh, 'auth', auth, 'kind', 'play', 'name', username, 'streak', case when streak_alive then streak else 0 end)), '[]') into out from s;
  else out := '[]'; end if;
  return out;
end $$;
revoke all on function public.push_due(integer) from public, anon, authenticated;
grant execute on function public.push_due(integer) to service_role;
