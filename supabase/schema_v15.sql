-- AL AGUA PEDRO · versión 15 del esquema (ejecutar DESPUÉS de schema_v14.sql; o ejecuta schema_todo.sql, que lo incluye todo).
--  · Paguitas por niveles: hasta el nivel 7 caen más a menudo (120 → 56 s); desde el 8 cada moneda vale más:
--    ×2 (niveles 8–10), ×3 (11–13) y ×4 (14–15). Igual que js/economy.js. El guardado lo tiene en cuenta.
--  · Ruleta legendaria de la tienda: ya NO se vende. Se consigue viendo 3 vídeos (uno de 3 al día como mucho:
--    una tirada legendaria diaria). Sigue tocando gratis en los niveles 10, 20, 30, 40 y 50.
-- Conserva todos los jugadores y su progreso. Se puede ejecutar más de una vez.

create or replace function public.fn_paguitas_every(p_level integer) returns numeric language sql immutable as $$
  select round(120 * power(0.88, least(greatest(p_level, 1), 7) - 1)) $$;
create or replace function public.fn_paguitas_value(p_level integer) returns integer language sql immutable as $$
  select case when p_level < 8 then 1 when p_level < 11 then 2 when p_level < 14 then 3 else 4 end $$;

-- Guardado: igual que en la versión 6, con el nuevo límite de las paguitas
create or replace function public.save_progress(p_total_clicks bigint, p_tomatoes_thrown integer, p_hits integer, p_perfects integer, p_falls integer, p_pesetas_earned integer, p_tomatoes_refunded integer default 0, p_paguitas_pesetas integer default 0)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare cur public.profiles; new_row public.profiles; secs numeric; max_clicks bigint; v_clicks bigint; v_thrown integer; v_hits integer; v_perf integer; v_falls integer; v_pes integer; v_ref integer; v_pag integer; lvl integer; every numeric;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select * into cur from public.profiles where user_id = auth.uid() for update;
  if not found then insert into public.profiles (user_id) values (auth.uid()) returning * into cur; end if;
  v_clicks := greatest(cur.total_clicks, coalesce(p_total_clicks, 0));
  -- límite contra automatizaciones: máx. 25 pulsaciones/segundo con la racha ×3 (75 por los clics de cada pulsación) desde el último guardado, +1800 de margen
  secs := extract(epoch from (now() - cur.updated_at));
  max_clicks := cur.total_clicks + 1800 * public.fn_clicks_per_tap(cur.cards, cur.falcon_until) + floor(secs * 75 * public.fn_clicks_per_tap(cur.cards, cur.falcon_until))::bigint;
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
  update public.profiles set total_clicks = v_clicks, tomatoes_thrown = v_thrown, hits = v_hits, perfects = v_perf, falls = v_falls, pesetas_earned = v_pes, tomatoes_refunded = v_ref, paguitas_pesetas = v_pag, updated_at = now()
  where user_id = auth.uid() returning * into new_row;
  return new_row;
end $$;
grant execute on function public.save_progress(bigint, integer, integer, integer, integer, integer, integer, integer) to authenticated;
revoke execute on function public.save_progress(bigint, integer, integer, integer, integer, integer, integer, integer) from anon;

-- Vídeos para la ruleta legendaria: cada 3 vídeos, una tirada (como mucho 3 vídeos al día)
alter table public.profiles add column if not exists legend_ads integer not null default 0 check (legend_ads >= 0);
create or replace function public.claim_ad_reward(p_placement text, p_token text) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare cur public.profiles; today text := ((now() at time zone 'Europe/Madrid')::date)::text; claims jsonb; n integer; lim integer; row_out public.profiles;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  if coalesce((select value from public.aap_config where key = 'rewarded_ads'), 'false') <> 'true' then raise exception 'Los anuncios todavía no están disponibles'; end if;
  if p_placement not in ('falcon', 'sobre', 'ruleta') then raise exception 'Esa oferta no existe'; end if;
  select * into cur from public.profiles where user_id = auth.uid() for update;
  if not found then raise exception 'El perfil no existe'; end if;
  claims := case when cur.ad_claims->>'day' = today then cur.ad_claims else jsonb_build_object('day', today) end;
  n := coalesce((claims->>p_placement)::integer, 0);
  lim := case p_placement when 'sobre' then 10 when 'ruleta' then 3 else 6 end;
  if n >= lim then raise exception 'Ya has visto todos los vídeos de hoy para esta oferta. Vuelve mañana'; end if;
  claims := jsonb_set(claims, array[p_placement], to_jsonb(n + 1));
  if p_placement = 'falcon' then
    if cur.falcon_until is not null and cur.falcon_until > now() then raise exception 'El Falcón ya está en marcha'; end if;
    update public.profiles set falcon_until = now() + interval '10 minutes', ad_claims = claims where user_id = auth.uid() returning * into row_out;
  elsif p_placement = 'ruleta' then
    update public.profiles set legend_ads = case when legend_ads + 1 >= 3 then 0 else legend_ads + 1 end,
      legend_spins = legend_spins + case when legend_ads + 1 >= 3 then 1 else 0 end, ad_claims = claims, updated_at = now()
    where user_id = auth.uid() returning * into row_out;
  else
    update public.profiles set chest_pesetas = chest_pesetas + 25, ad_claims = claims, updated_at = now() where user_id = auth.uid() returning * into row_out;
  end if;
  return row_out;
end $$;
revoke all on function public.claim_ad_reward(text, text) from public, anon;
grant execute on function public.claim_ad_reward(text, text) to authenticated;

-- La tirada legendaria ya no se vende con dinero real
create or replace function public.fn_pack(p text) returns jsonb language sql immutable as $$
  select case p
    when 'calderilla' then '{"pesetas": 750, "tomatoes": 300, "cards": 0}'::jsonb
    when 'maletin'    then '{"pesetas": 1750, "tomatoes": 700, "cards": 0}'::jsonb
    when 'camara'     then '{"pesetas": 5000, "tomatoes": 2000, "cards": 4}'::jsonb
  end $$;
