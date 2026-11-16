-- AL AGUA PEDRO · versión 23 del esquema (ejecutar DESPUÉS de schema_v22.sql; o ejecuta schema_todo.sql, que lo incluye todo).
--  · Progresión más pausada: los primeros niveles cuestan más (nivel 2: 450 XP, nivel 3: 1.300, nivel 5: 3.950, nivel 10: 18.250)
--    y del nivel 10 en adelante, subir del k al k+1 cuesta 16·k^2,4 XP (antes 12,6·k^2,4). Llegar al 50: unos 2,7 millones de XP.
--    Igual que XP_AT en js/levels.js.
--  · Quien baje de nivel no pierde nada de lo que tiene y vuelve a tener ruleta al subir el siguiente nivel.
-- Conserva todos los jugadores y su progreso. Se puede ejecutar más de una vez.

create or replace function public.fn_level_of_xp(p_xp bigint) returns integer language sql immutable as $$
  select 1 + count(*)::integer from unnest(array[450, 1300, 2450, 3950, 5850, 8200, 11050, 14400, 18250, 22270, 27320, 33550, 41090, 50100, 60740, 73160, 87520, 103990, 122750, 143960, 167810, 194470, 224140, 257000, 293240, 333060, 376650, 424220, 475970, 532100, 592830, 658370, 728930, 804730, 885990, 972940, 1065790, 1164780, 1270140, 1382100, 1500900, 1626770, 1759950, 1900690, 2049230, 2205810, 2370690, 2544110, 2726330]::bigint[]) t where p_xp >= t $$;

-- quien queda en un nivel más bajo que su última ruleta: la siguiente subida vuelve a dar ruleta
update public.profiles set wheel_level = greatest(1, public.fn_player_level(tomatoes_thrown, hits, falls))
where wheel_level > public.fn_player_level(tomatoes_thrown, hits, falls);
