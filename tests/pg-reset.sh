#!/bin/sh
# Crea una base de datos de pruebas limpia con el esquema del juego. Uso: sh tests/pg-reset.sh   (PostgreSQL local en /tmp:5433)
set -e
PSQL="psql -h ${PGHOST:-/tmp} -p ${PGPORT:-5433} -U postgres -q -v ON_ERROR_STOP=1"
$PSQL -c "drop database if exists aap" -c "create database aap"
$PSQL -d aap -f tests/pg-stub.sql -f supabase/schema.sql -f supabase/schema_v2.sql -f supabase/schema_v3.sql -f supabase/schema_v4.sql -f supabase/schema_v5.sql -f supabase/schema_v6.sql -f supabase/schema_v7.sql 2>&1 | grep -v NOTICE || true
echo "base de datos aap lista"
