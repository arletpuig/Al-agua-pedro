#!/bin/sh
# Regenera schema_todo.sql (todos los esquemas en orden, en una sola transacción). Uso: sh supabase/make-todo.sh
cd "$(dirname "$0")"
{ cat <<'H'
-- AL AGUA PEDRO · ACTUALIZACIÓN COMPLETA (todo en uno)
-- Lleva la base de datos a la última versión desde CUALQUIER versión anterior (incluso desde cero).
-- Es lo mismo que ejecutar schema.sql y schema_v2.sql, schema_v3.sql... seguidos.
-- Conserva todos los jugadores y su progreso. Se puede ejecutar más de una vez.
-- Va todo en una transacción: si algo fallara, no se cambia nada.
begin;
-- la vista del ranking se rehace más abajo (así el esquema base se puede volver a ejecutar sobre una base ya actualizada)
drop view if exists public.leaderboard;

H
for f in schema schema_v2 schema_v3 schema_v4 schema_v5 schema_v6 schema_v7 schema_v8 schema_v9 schema_v10; do printf '\n-- ===================================================================== %s.sql\n' "$f"; cat $f.sql; done
printf '\ncommit;\n'; } > schema_todo.sql
