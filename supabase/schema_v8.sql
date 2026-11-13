-- AL AGUA PEDRO · versión 8 del esquema (ejecutar DESPUÉS de schema_v7.sql; o ejecuta schema_todo.sql, que lo incluye todo).
-- Las banderas del perfil se validan por formato (minúsculas, números y guiones), no con una lista fija:
-- así se pueden añadir banderas nuevas en el juego sin volver a tocar la base de datos.
-- Si alguien guarda un nombre de bandera que no existe, el juego muestra la de España.
create or replace function public.fn_avatar_ok(p text) returns boolean language sql immutable as $$
  select p ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(p) <= 40 $$;
