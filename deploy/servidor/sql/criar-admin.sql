-- Primeiro Administrador da produção (docs/deploy-windows.md, passo 9).
--
-- O seed de desenvolvimento se recusa a rodar em produção, e quem entra pela primeira vez vira
-- Leitor inativo (CLAUDE.md 6). Este script pré-cadastra o Administrador pelo e-mail
-- corporativo: no primeiro login com a conta Microsoft, a API liga o `oid` a este cadastro.
-- Depois disso, os demais usuários são ativados pela tela Cadastros.
--
--   psql -U metas_owner -d metas -v ON_ERROR_STOP=1 ^
--        -v email="nome.sobrenome@ectas.com.br" -v nome="Nome Sobrenome" -f criar-admin.sql
--
-- Se o e-mail já existir (alguém entrou antes), o usuário vira Administrador ativo.

BEGIN;

INSERT INTO usuario (nome, email, perfil, ativo)
VALUES (:'nome', lower(:'email'), 'ADMIN', true)
ON CONFLICT (email) DO UPDATE SET perfil = 'ADMIN', ativo = true;

-- Auditoria (somente inclusão): fica registrado que o Administrador veio da instalação.
INSERT INTO auditoria (entidade, entidade_id, acao, depois)
SELECT 'usuario', id::text, 'CRIAR_ADMIN_INSTALACAO',
       jsonb_build_object('email', email, 'perfil', perfil, 'ativo', ativo,
                          'origem', 'deploy/servidor/sql/criar-admin.sql')
FROM usuario
WHERE email = lower(:'email');

COMMIT;

SELECT nome, email, perfil, ativo FROM usuario WHERE email = lower(:'email');
