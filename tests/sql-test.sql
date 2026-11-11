-- Prueba funcional de las RPC con un usuario simulado (PostgreSQL local con esquema auth simulado). Ver tests/README.md
\set ON_ERROR_STOP on
insert into auth.users (id, email, raw_user_meta_data) values ('11111111-1111-1111-1111-111111111111', 'a@b.com', '{"username":"Arlet"}');
set role authenticated; set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select username, total_clicks, pesetas, tomatoes from public.profiles;
-- guardado: 250 clics, 1 lanzado, 1 caída con 2 pesetas (Joyas) -> dentro de límites
select total_clicks, tomatoes_earned, tomatoes, clicks_progress, pesetas_earned, pesetas from public.save_progress(250, 1, 1, 1, 1, 2);
-- intento de trampa: 999999 clics de golpe y 50 pesetas -> se recorta
select total_clicks < 100000 as clics_recortados, pesetas_earned = 3 as pesetas_recortadas from public.save_progress(999999, 1, 1, 1, 1, 50);
-- cofre sin pesetas suficientes -> error esperado
do $$ begin perform public.open_chest('wood'); raise exception 'NO DEBERIA LLEGAR'; exception when others then raise notice 'ok error esperado: %', sqlerrm; end $$;
-- cofre diario gratis, dos veces -> la segunda falla
select (public.claim_daily())->'reward'->>'kind' as cofre_diario;
do $$ begin perform public.claim_daily(); raise exception 'NO DEBERIA LLEGAR'; exception when others then raise notice 'ok error esperado: %', sqlerrm; end $$;
-- damos pesetas legítimas: simulamos una hora de juego (límite de ritmo) y 200 caídas -> 200 pesetas
reset role; update public.profiles set updated_at = now() - interval '1 hour'; set role authenticated;
select pesetas from public.save_progress(30000, 200, 200, 200, 200, 200);
select (r->'reward'->>'tomatoes')::int > 0 as da_tomates, jsonb_array_length(r->'reward'->'cards') as n_cartas, (r->'profile'->>'pesetas')::int as pesetas_despues from public.open_chest('wood') r;
select jsonb_array_length(r->'reward'->'cards') >= 3 as diamante_3_cartas from public.open_chest('diamond') r;
-- forzamos cartas para probar mejora (como superusuario)
reset role; update public.profiles set cards = jsonb_set(cards, '{inflacion}', '{"level":1,"frags":5}'), pesetas_earned = 200 where user_id = '11111111-1111-1111-1111-111111111111';
set role authenticated;
select cards->'inflacion' as antes, pesetas as pesetas_antes from public.profiles;
select cards->'inflacion' as despues, pesetas as pesetas_despues from public.upgrade_card('inflacion');
-- importación de invitado solo en perfil vacío -> error esperado aquí
do $$ begin perform public.import_guest('{"totalClicks":500}'); raise exception 'NO DEBERIA LLEGAR'; exception when others then raise notice 'ok error esperado: %', sqlerrm; end $$;
-- anuncios: siempre rechazado mientras no haya proveedor
do $$ begin perform public.claim_ad_reward('falcon', 'x'); raise exception 'NO DEBERIA LLEGAR'; exception when others then raise notice 'ok error esperado: %', sqlerrm; end $$;
-- escritura directa prohibida
do $$ begin update public.profiles set pesetas_earned = 9999; raise exception 'NO DEBERIA LLEGAR'; exception when others then raise notice 'ok error esperado: %', sqlerrm; end $$;
-- invitado nuevo: importación
reset role; insert into auth.users (id, email) values ('22222222-2222-2222-2222-222222222222', 'c@d.com');
set role authenticated; set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select total_clicks, tomatoes, pesetas, cards->'apagon' as apagon from public.import_guest('{"totalClicks":1234,"tomatoesThrown":5,"hits":3,"perfects":2,"falls":2,"pesetasEarned":2,"chestTomatoes":4,"chestPesetas":1,"pesetasSpent":0,"cards":{"apagon":{"level":99,"frags":2}}}');
-- ranking y hora, sin sesión
set role anon; reset request.jwt.claim.sub;
select * from public.leaderboard;
select server_now()->>'date' as fecha, (server_now()->>'next_midnight')::timestamptz > now() as medianoche_futura;
do $$ begin perform public.save_progress(1,0,0,0,0,0); raise exception 'NO DEBERIA LLEGAR'; exception when others then raise notice 'ok error esperado (anon): %', sqlerrm; end $$;
