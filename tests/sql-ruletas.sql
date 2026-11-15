-- Comprueba que TODO lo que da la ruleta se entrega (cientos de tiradas de cada tipo). Uso:
--   sh tests/pg-reset.sh && psql -h /tmp -p 5433 -U postgres -d aap -f tests/sql-ruletas.sql
\set ON_ERROR_STOP 1
insert into auth.users (email) values ('ruleta@test.es');
select id as uid from auth.users where email = 'ruleta@test.es' \gset
update public.profiles set tomatoes_thrown = 100000, hits = 0, falls = 0, wheel_level = 1, chest_pesetas = 2000000, total_clicks = 50000000 where user_id = :'uid';
set role authenticated;
select set_config('request.jwt.claim.sub', :'uid', false);
create temp table log (src text, wheel text, id text, ok boolean, why text);
do $$
declare b public.profiles; a public.profiles; r jsonb; rw jsonb; i integer; ok boolean; why text; ncards integer; got integer; src text; fr_b integer; fr_a integer;
begin
  for i in 1 .. 649 loop
    src := case when i <= 49 then 'nivel' when i <= 349 then 'tienda' else 'legendaria' end;
    select * into b from public.profiles where user_id = current_setting('request.jwt.claim.sub')::uuid;
    if src = 'legendaria' then
      reset role; update public.profiles set legend_spins = 1 where user_id = current_setting('request.jwt.claim.sub')::uuid; set role authenticated;
      select * into b from public.profiles where user_id = current_setting('request.jwt.claim.sub')::uuid;
      r := public.spin_legend_wheel();
    elsif src = 'tienda' then r := public.buy_wheel_spin();
    else r := public.spin_level_wheel(); end if;
    select * into a from public.profiles where user_id = current_setting('request.jwt.claim.sub')::uuid;
    rw := r->'reward';
    ncards := jsonb_array_length(rw->'cards');
    select coalesce(sum((v->>'level')::int * 1000 + (v->>'frags')::int), 0) into fr_b from jsonb_each(b.cards) t(k, v);
    select coalesce(sum((v->>'level')::int * 1000 + (v->>'frags')::int), 0) into fr_a from jsonb_each(a.cards) t(k, v);
    why := '';
    ok := a.chest_pesetas = b.chest_pesetas + (rw->>'pesetas')::int and a.chest_tomatoes = b.chest_tomatoes + (rw->>'tomatoes')::int;
    if not ok then why := why || 'pesetas/tomates '; end if;
    if a.pesetas_spent <> b.pesetas_spent + (r->>'cost')::int then ok := false; why := why || 'coste '; end if;
    if src = 'tienda' and (r->>'cost')::int <> 40 + 3 * 50 then ok := false; why := why || 'precio '; end if;
    if (rw->>'minutes')::int > 0 and not (a.falcon_until >= greatest(now(), coalesce(b.falcon_until, now())) + make_interval(mins => (rw->>'minutes')::int) - interval '1 second') then ok := false; why := why || 'falcon '; end if;
    if (rw->>'minutes')::int = 0 and a.falcon_until is distinct from b.falcon_until then ok := false; why := why || 'falcon-sin-premio '; end if;
    if rw->>'id' in ('card', 'cards3', 'l_dia', 'l_top') and ncards <> (case (rw->>'id') when 'card' then 1 when 'cards3' then 3 when 'l_dia' then 6 else 4 end) then ok := false; why := why || 'num-cartas '; end if;
    if ncards > 0 and fr_a <= fr_b then ok := false; why := why || 'cartas-no-guardadas '; end if;
    if ncards = 0 and a.cards <> b.cards then ok := false; why := why || 'cartas-de-mas '; end if;
    if src = 'nivel' and (a.wheel_level <> b.wheel_level + 1 or (r->>'wheel') <> (case when a.wheel_level % 10 = 0 then 'legend' else 'normal' end)) then ok := false; why := why || 'nivel '; end if;
    if src <> 'nivel' and a.wheel_level <> b.wheel_level then ok := false; why := why || 'tocó-nivel '; end if;
    if src = 'legendaria' and (a.legend_spins <> 0 or r->>'wheel' <> 'legend') then ok := false; why := why || 'legendaria '; end if;
    if src = 'tienda' and r->>'wheel' <> 'normal' then ok := false; why := why || 'tipo '; end if;
    insert into log values (src, r->>'wheel', rw->>'id', ok, why);
  end loop;
end $$;
select src, wheel, count(*) filter (where ok) as bien, count(*) filter (where not ok) as mal, string_agg(distinct nullif(why, ''), ',') as fallos from log group by 1, 2 order by 1, 2;
select wheel, id, count(*) from log group by 1, 2 order by 1, 3 desc;
do $$ begin perform public.spin_legend_wheel(); raise exception 'MAL: dejó girar sin tirada'; exception when others then if sqlerrm like 'MAL%' then raise; end if; raise notice 'ok sin tirada legendaria: %', sqlerrm; end $$;
do $$ begin perform public.spin_level_wheel(); raise exception 'MAL: dejó girar sin nivel'; exception when others then if sqlerrm like 'MAL%' then raise; end if; raise notice 'ok sin tirada de nivel: %', sqlerrm; end $$;
reset role;
update public.profiles set chest_pesetas = 0, pesetas_earned = 0, paguitas_pesetas = 0, pesetas_spent = 0 where user_id = :'uid';
set role authenticated;
do $$ begin perform public.buy_wheel_spin(); raise exception 'MAL: compró sin pesetas'; exception when others then if sqlerrm like 'MAL%' then raise; end if; raise notice 'ok sin pesetas: %', sqlerrm; end $$;
do $$ begin perform public.grant_pack('cs_trampa', current_setting('request.jwt.claim.sub')::uuid, 'calderilla', 0, 'eur'); raise exception 'MAL: el jugador se dio un pack'; exception when others then if sqlerrm like 'MAL%' then raise; end if; raise notice 'ok no se puede regalar tiradas: %', sqlerrm; end $$;
do $$ begin perform public.fn_wheel_grant(current_setting('request.jwt.claim.sub')::uuid, 'legend', 50, 0, null, 0); raise exception 'MAL: llamó a la función interna'; exception when others then if sqlerrm like 'MAL%' then raise; end if; raise notice 'ok función interna protegida: %', sqlerrm; end $$;

-- Ruleta legendaria con vídeos: 3 vídeos = 1 tirada; como mucho 3 al día. Ya no se vende.
reset role;
insert into public.aap_config (key, value) values ('rewarded_ads', 'true') on conflict (key) do update set value = 'true';
update public.profiles set legend_spins = 0, legend_ads = 0, ad_claims = '{}'::jsonb where user_id = :'uid';
set role authenticated;
do $$ declare r public.profiles; out text := ''; i integer;
begin
  for i in 1 .. 3 loop r := public.claim_ad_reward('ruleta', 'demo'); out := out || r.legend_ads || '/' || r.legend_spins || ' '; end loop;
  if out <> '1/0 2/0 0/1 ' then raise exception 'MAL vídeos: %', out; end if;
  begin perform public.claim_ad_reward('ruleta', 'demo'); raise exception 'MAL: cuarto vídeo'; exception when others then if sqlerrm like 'MAL%' then raise; end if; end;
  raise notice 'ok 3 vídeos = 1 tirada legendaria (%), y no más de 3 al día', out;
end $$;
do $$ begin if public.fn_pack('ruleta') is null then raise notice 'ok la tirada legendaria ya no se vende'; else raise exception 'MAL: se sigue vendiendo'; end if; end $$;
-- Paguitas: el guardado admite el nuevo valor de las monedas (nivel 15: ×4) y no más
reset role;
update public.profiles set cards = jsonb_set(cards, '{paguitas}', '{"level": 15, "frags": 0}'), paguitas_pesetas = 0, updated_at = now() - interval '112 seconds' where user_id = :'uid';
set role authenticated;
do $$ declare r public.profiles; begin
  r := public.save_progress(0, 0, 0, 0, 0, 0, 0, 1000);
  -- 112 s / 75 s = 1 lluvia (+2 de margen) = 3 × 3 monedas × 8 (nivel 15: 24 por lluvia) = 72 como mucho
  if r.paguitas_pesetas <> 72 then raise exception 'MAL paguitas: %', r.paguitas_pesetas; end if;
  raise notice 'ok paguitas nivel 15: como mucho 72 pesetas en 112 s (3 monedas de 8)';
end $$;
