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
-- las vistas de los rankings se rehacen más abajo (así el esquema base se puede volver a ejecutar sobre una base ya actualizada)
drop view if exists public.leaderboard;
drop view if exists public.region_ranking;
drop view if exists public.region_leaders;

H
for f in schema schema_v2 schema_v3 schema_v4 schema_v5 schema_v6 schema_v7 schema_v8 schema_v9 schema_v10 schema_v11 schema_v12 schema_v13 schema_v14 schema_v15 schema_v16 schema_v17; do printf '\n-- ===================================================================== %s.sql\n' "$f"; cat $f.sql; done
printf '\ncommit;\n'; } > schema_todo.sql
