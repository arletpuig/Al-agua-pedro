-- AL AGUA PEDRO · versión 29 del esquema (ejecutar DESPUÉS de schema_v28.sql; o ejecuta schema_todo.sql, que lo incluye todo).
--  · Tomates que «desaparecían» con el Falcón: el límite de clics de cada guardado contaba el Falcón solo si seguía en marcha
--    al guardar. Si guardabas justo después de que terminara, se recortaban los clics hechos con él (y con ellos tus tomates
--    y tu nivel, y la ruleta del nivel no llegaba). Ahora cuenta ×5 si el Falcón ha estado en marcha desde el último guardado.
-- Conserva todos los jugadores y su progreso. Se puede ejecutar más de una vez.

create or replace function public.save_progress(p_total_clicks bigint, p_tomatoes_thrown integer, p_hits integer, p_perfects integer, p_falls integer, p_pesetas_earned integer, p_tomatoes_refunded integer default 0, p_paguitas_pesetas integer default 0, p_streak_pesetas integer default 0)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare cpt integer; cur public.profiles; new_row public.profiles; secs numeric; max_clicks bigint; v_clicks bigint; v_thrown integer; v_hits integer; v_perf integer; v_falls integer; v_pes integer; v_ref integer; v_pag integer; v_str integer; lvl integer; every numeric;
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
  -- Racha de lanzamientos: pesetas extra. Como mucho 45 por cada caída nueva de este guardado (lo más que da un acierto con premio)
  -- y, en total, 15 por caída de toda la partida (de media da menos de 8)
  v_str := greatest(cur.streak_pesetas, least(coalesce(p_streak_pesetas, 0), cur.streak_pesetas + 45 * greatest(0, v_falls - cur.falls), 15 * v_falls));
  update public.profiles set streak_pesetas = v_str, total_clicks = v_clicks, tomatoes_thrown = v_thrown, hits = v_hits, perfects = v_perf, falls = v_falls, pesetas_earned = v_pes, tomatoes_refunded = v_ref, paguitas_pesetas = v_pag, updated_at = now()
  where user_id = auth.uid() returning * into new_row;
  return new_row;
end $$;
grant execute on function public.save_progress(bigint, integer, integer, integer, integer, integer, integer, integer, integer) to authenticated;
revoke execute on function public.save_progress(bigint, integer, integer, integer, integer, integer, integer, integer, integer) from public, anon;
