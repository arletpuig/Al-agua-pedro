-- AL AGUA PEDRO · versión 24 del esquema (ejecutar DESPUÉS de schema_v23.sql; o ejecuta schema_todo.sql, que lo incluye todo).
--  · Progresión más lenta: todos los niveles cuestan 1,5 veces más que en la versión 23
--    (nivel 2: 600 XP, nivel 3: 1.900, nivel 5: 5.850, nivel 10: 27.200; del 10 en adelante, del k al k+1 cuesta 24·k^2,4 XP).
--    Llegar al 50: unos 4,1 millones de XP. Igual que XP_AT en js/levels.js.
--  · Quien baje de nivel no pierde nada de lo que tiene y vuelve a tener ruleta al subir el siguiente nivel.
-- Conserva todos los jugadores y su progreso. Se puede ejecutar más de una vez.

create or replace function public.fn_level_of_xp(p_xp bigint) returns integer language sql immutable as $$
  select 1 + count(*)::integer from unnest(array[600, 1900, 3600, 5850, 8700, 12200, 16450, 21450, 27200, 33230, 40810, 50150, 61470, 74990, 90940, 109570, 131110, 155820, 183950, 215770, 251540, 291540, 336040, 385330, 439690, 499410, 564800, 636150, 713770, 797970, 889060, 987360, 1093200, 1206900, 1328790, 1459210, 1598490, 1746980, 1905020, 2072960, 2251150, 2439950, 2639720, 2850820, 3073620, 3308490, 3555800, 3815930, 4089260]::bigint[]) t where p_xp >= t $$;

-- quien queda en un nivel más bajo que su última ruleta: la siguiente subida vuelve a dar ruleta
-- (corrección de un solo uso, ya aplicada: desactivada para que volver a ejecutar este archivo o el «todo en uno»
--  no baje el contador de tiradas con la escala antigua y regale ruletas)
