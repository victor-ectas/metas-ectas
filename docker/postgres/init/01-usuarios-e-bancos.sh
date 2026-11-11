#!/bin/sh
# Cria os usuários e os bancos do sistema de metas (desenvolvimento).
#
# - metas_owner: dono dos bancos e do esquema; roda as migrações (CREATEDB para o banco-sombra
#   do `prisma migrate dev`).
# - metas_app: usuário da aplicação, com privilégios mínimos: só lê e escreve dados.
#   Não cria nem altera tabelas.
# - metas (desenvolvimento) e metas_teste (testes de integração).
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  -v senha_owner="$METAS_OWNER_PASSWORD" -v senha_app="$METAS_APP_PASSWORD" <<'SQL'
CREATE ROLE metas_owner LOGIN CREATEDB PASSWORD :'senha_owner';
CREATE ROLE metas_app LOGIN PASSWORD :'senha_app';
CREATE DATABASE metas OWNER metas_owner;
CREATE DATABASE metas_teste OWNER metas_owner;
SQL

for banco in metas metas_teste; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$banco" <<'SQL'
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO metas_app;
-- Tudo o que o metas_owner criar (pelas migrações) já nasce acessível ao metas_app, só para dados.
ALTER DEFAULT PRIVILEGES FOR ROLE metas_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO metas_app;
ALTER DEFAULT PRIVILEGES FOR ROLE metas_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO metas_app;
ALTER DEFAULT PRIVILEGES FOR ROLE metas_owner IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO metas_app;
SQL
done
