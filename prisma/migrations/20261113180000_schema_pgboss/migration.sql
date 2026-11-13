-- Schema da fila de jobs (pg-boss, P22, ADR-028).
--
-- O pg-boss cria e migra as próprias tabelas ao iniciar, conectado como o usuário da aplicação
-- (metas_app), que não pode criar schemas no banco. Por isso o schema nasce aqui, com o dono do
-- esquema, e o metas_app recebe só USAGE e CREATE nele: as tabelas da fila ficam dele, sem
-- nenhum privilégio a mais no banco nem no schema public. O serviço de jobs inicia o pg-boss com
-- createSchema: false.
CREATE SCHEMA IF NOT EXISTS pgboss;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'metas_app') THEN
    GRANT USAGE, CREATE ON SCHEMA pgboss TO metas_app;
  ELSE
    RAISE NOTICE 'Usuário metas_app não existe: conceda USAGE e CREATE no schema pgboss ao usuário da aplicação.';
  END IF;
END $$;
