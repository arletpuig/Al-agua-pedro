-- AL AGUA PEDRO · versión 3 del esquema (ejecutar DESPUÉS de schema.sql y schema_v2.sql).
-- Cambios que acompañan a la nueva versión del juego:
--  1. Cofres más baratos: madera 8 pesetas (antes 15), diamante 40 (antes 80).
--  2. Racha de pulsaciones (hasta ×3): el límite contra automatizaciones sube de 25 a 75 clics por segundo
--     (por los clics de cada pulsación), con más margen.
--  3. Regalo de bienvenida para cuentas nuevas: 5 tomates y 10 pesetas (los invitados ya lo reciben en el juego).
-- Conserva todos los jugadores y su progreso. Se puede ejecutar más de una vez.

alter table public.profiles alter column chest_tomatoes set default 5;
alter table public.profiles alter column chest_pesetas set default 10;

create or replace function public.save_progress(p_total_clicks bigint, p_tomatoes_thrown integer, p_hits integer, p_perfects integer, p_falls integer, p_pesetas_earned integer)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare cur public.profiles; new_row public.profiles; secs numeric; max_clicks bigint; v_clicks bigint; v_thrown integer; v_hits integer; v_perf integer; v_falls integer; v_pes integer;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select * into cur from public.profiles where user_id = auth.uid() for update;
  if not found then insert into public.profiles (user_id) values (auth.uid()) returning * into cur; end if;
  v_clicks := greatest(cur.total_clicks, coalesce(p_total_clicks, 0));
  -- límite contra automatizaciones: máx. 25 pulsaciones/segundo con la racha ×3 (75 por los clics de cada pulsación) desde el último guardado, +1800 de margen
  secs := extract(epoch from (now() - cur.updated_at));
  max_clicks := cur.total_clicks + 1800 * public.fn_clicks_per_tap(cur.cards, cur.falcon_until) + floor(secs * 75 * public.fn_clicks_per_tap(cur.cards, cur.falcon_until))::bigint;
  v_clicks := least(v_clicks, max_clicks);
  v_thrown := least(greatest(cur.tomatoes_thrown, coalesce(p_tomatoes_thrown, 0)), (v_clicks / 100)::integer + cur.chest_tomatoes);
  v_hits := least(greatest(cur.hits, coalesce(p_hits, 0)), v_thrown);
  v_perf := least(greatest(cur.perfects, coalesce(p_perfects, 0)), v_hits);
  v_falls := least(greatest(cur.falls, coalesce(p_falls, 0)), v_hits);
  v_pes := least(greatest(cur.pesetas_earned, coalesce(p_pesetas_earned, 0)), v_falls * 3);
  update public.profiles set total_clicks = v_clicks, tomatoes_thrown = v_thrown, hits = v_hits, perfects = v_perf, falls = v_falls, pesetas_earned = v_pes, updated_at = now()
  where user_id = auth.uid() returning * into new_row;
  return new_row;
end $$;

create or replace function public.open_chest(p_kind text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cur public.profiles; price integer; roll jsonb; row_out public.profiles;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if p_kind not in ('wood', 'diamond') then raise exception 'Cofre desconocido'; end if;
  price := case p_kind when 'wood' then 8 else 40 end;
  select * into cur from public.profiles where user_id = auth.uid() for update;
  if not found then raise exception 'Perfil no encontrado'; end if;
  if cur.pesetas < price then raise exception 'No tienes pesetas suficientes'; end if;
  roll := public.fn_roll_chest(p_kind, cur.cards);
  update public.profiles set cards = roll->'cards', chest_tomatoes = chest_tomatoes + (roll->'reward'->>'tomatoes')::integer,
    chest_pesetas = chest_pesetas + (roll->'reward'->>'pesetas')::integer, pesetas_spent = pesetas_spent + price, chests_opened = chests_opened + 1, updated_at = now()
  where user_id = auth.uid() returning * into row_out;
  return jsonb_build_object('reward', roll->'reward', 'profile', to_jsonb(row_out));
end $$;
