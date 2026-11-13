-- Cria os usuários e o banco do sistema de metas em produção (docs/deploy-windows.md, passo 3).
-- Rode UMA vez, como o superusuário `postgres`, no banco `postgres`:
--
--   psql -U postgres -d postgres -v ON_ERROR_STOP=1 ^
--        -v senha_owner="..." -v senha_app="..." -f criar-banco.sql
--
-- - metas_owner: dono do banco e do esquema; só as migrações (publicar.ps1) e o backup usam.
-- - metas_app: usuário da API e dos jobs, com privilégios mínimos: lê e escreve dados, não cria
--   nem altera tabelas, e não consegue desligar os triggers de histórico e auditoria.

CREATE ROLE metas_owner LOGIN PASSWORD :'senha_owner';
CREATE ROLE metas_app LOGIN PASSWORD :'senha_app';
CREATE DATABASE metas OWNER metas_owner ENCODING 'UTF8' TEMPLATE template0;

\connect metas

REVOKE ALL ON DATABASE metas FROM PUBLIC;
GRANT CONNECT ON DATABASE metas TO metas_owner, metas_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO metas_owner;
GRANT USAGE ON SCHEMA public TO metas_app;

-- Tudo o que o metas_owner criar (pelas migrações) já nasce acessível ao metas_app, só para dados.
ALTER DEFAULT PRIVILEGES FOR ROLE metas_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO metas_app;
ALTER DEFAULT PRIVILEGES FOR ROLE metas_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO metas_app;
ALTER DEFAULT PRIVILEGES FOR ROLE metas_owner IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO metas_app;
