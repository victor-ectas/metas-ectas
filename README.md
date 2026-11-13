# Sistema de Gestão de Metas

Aplicação web interna que substitui as planilhas de metas dos gestores: cadastro de metas e fórmulas, lançamento mensal das variáveis, cálculo de resultado, atendimento, pontuação e nota, com trava de meses fechados.

- Regras completas: [docs/especificacao.md](docs/especificacao.md)
- Instruções de desenvolvimento e plano passo a passo: [CLAUDE.md](CLAUDE.md)
- Decisões técnicas: [docs/decisoes.md](docs/decisoes.md)

## Pré-requisitos

- **Node.js 26 LTS** (versão exata em [.nvmrc](.nvmrc)).
- **pnpm** na versão de `packageManager` do [package.json](package.json). O Node 26 não traz mais o corepack; instale pelo npm, na versão exata:

  ```sh
  npm install -g pnpm@10.34.9
  ```

- **Docker Desktop**, para o PostgreSQL de desenvolvimento (`postgres:17.11-alpine`, porta 5433), a mesma versão major do servidor de produção (PostgreSQL 17).

## Como rodar

```sh
pnpm install           # instala as dependências e gera o client Prisma
cp .env.example .env   # preencha as senhas (o .env nunca vai para o git)
pnpm db:subir          # sobe o PostgreSQL no Docker (cria usuários e bancos na 1ª vez)
pnpm db:migrar         # aplica as migrações no banco de desenvolvimento
pnpm db:seed           # Administrador (SEED_ADMIN_EMAIL), setores, ciclo e feriados de exemplo
pnpm dev               # compila tipos/motor/prisma e sobe a API e a web (jobs entram no P22)
```

Com o `pnpm dev` no ar:

- Web: http://localhost:5173
- API: http://localhost:3000/api/v1 — saúde em `/api/v1/saude`
- Documentação OpenAPI (só fora de produção): http://localhost:3000/api/v1/docs

Mudou algo em `packages/` ou `prisma/`? Reinicie o `pnpm dev` para a API usar o novo build (a web lê o código-fonte dos pacotes e recarrega sozinha).

### Login em desenvolvimento

Sem um tenant do Entra ID, use o **modo DEV** no `.env`: `AUTH_DEV=true`, `VITE_AUTH_DEV=true` e `AUTH_DEV_EMAIL` com o e-mail de um usuário cadastrado (o Administrador do seed serve). A API então não pede token e entra como esse usuário. Na web, o chip laranja "DEV" no topo troca o usuário simulado (cabeçalho `X-Usuario-Dev: <e-mail>`). O modo DEV só funciona com `NODE_ENV=development`: em qualquer outro ambiente a API não inicia, e o build de produção da web nem inclui esse código.

Com o Entra ID, preencha `ENTRA_TENANT_ID` e `ENTRA_API_AUDIENCE` (API) e `VITE_ENTRA_CLIENT_ID`, `VITE_ENTRA_TENANT_ID` e `VITE_API_SCOPE` (web), e deixe `AUTH_DEV=false` e `VITE_AUTH_DEV=false`. No registro do aplicativo, cadastre `http://localhost:5173/` como URI de redirecionamento do tipo **SPA** (o Entra ID aceita `http` só em `localhost`). No primeiro login, quem não foi pré-cadastrado entra como Leitor inativo e só vê a própria sessão (`GET /api/v1/me`) até o Administrador ativá-lo.

### Banco de dados

O `docker-compose.yml` sobe um PostgreSQL só para desenvolvimento, com dois usuários:

| Usuário       | Uso                                       | Variável                                      |
| ------------- | ----------------------------------------- | --------------------------------------------- |
| `metas_owner` | Dono do esquema: migrações, seed e testes | `DATABASE_URL_MIGRACAO`, `DATABASE_URL_TESTE` |
| `metas_app`   | Aplicação: só lê e escreve dados          | `DATABASE_URL`                                |

e dois bancos: `metas` (desenvolvimento) e `metas_teste` (testes de integração). O `pnpm test` do pacote `@metas/prisma` aplica as migrações no `metas_teste` e roda cada teste numa transação desfeita, então **o PostgreSQL precisa estar no ar para o `pnpm verify` passar**.

Para mudar o esquema: edite `prisma/schema.prisma` e rode `pnpm db:migrar` (cria uma migração nova). Migrações já aplicadas não são editadas.

## Scripts

| Comando          | O que faz                                                     |
| ---------------- | ------------------------------------------------------------- |
| `pnpm dev`       | Sobe api, jobs e web em modo desenvolvimento                  |
| `pnpm build`     | Build de todos os pacotes                                     |
| `pnpm lint`      | ESLint e checagem de formatação (Prettier)                    |
| `pnpm format`    | Formata os arquivos com o Prettier                            |
| `pnpm typecheck` | Checagem de tipos de todos os pacotes                         |
| `pnpm test`      | Testes (Vitest) de todos os pacotes                           |
| `pnpm verify`    | `lint` + `typecheck` + `test`; tem que passar ao fim de passo |
| `pnpm db:subir`  | Sobe o PostgreSQL de desenvolvimento no Docker                |
| `pnpm db:parar`  | Para o contêiner (os dados ficam no volume)                   |
| `pnpm db:migrar` | Aplica ou cria migrações no banco de desenvolvimento          |
| `pnpm db:seed`   | Popula o banco de desenvolvimento com dados de exemplo        |
| `pnpm e2e`       | Testes ponta a ponta (Playwright, Edge): ver abaixo           |

Para rodar um script num pacote só: `pnpm --filter @metas/motor test`.

### Testes ponta a ponta

`pnpm e2e` compila a API, prepara o banco `metas_e2e_teste` (criado na primeira vez; a cada rodada ele recebe as migrações, tem os dados apagados e ganha um cenário fixo), sobe a API na porta 3100 e a web na 5174 em modo DEV, com o relógio fixo em 13/11/2026, e roda o fluxo do gestor no Microsoft Edge, em desktop e em 360 px. Ele não mexe nos bancos `metas` e `metas_teste` e pode rodar com o `pnpm dev` no ar. Precisa do PostgreSQL no ar e leva cerca de 1 minuto. Fica fora do `verify`; rode antes de cada publicação. Relatório de falhas: `apps/web/playwright-report`.

## Estrutura

```
apps/
  api/        API NestJS
  jobs/       serviço de jobs (pg-boss)
  web/        front-end React + Vite
packages/
  motor/      parser de fórmulas, cálculo e calendário (sem banco, sem HTTP)
  tipos/      enums, DTOs e schemas Zod compartilhados
prisma/       esquema, migrações, seed, testes do banco e client Prisma (@metas/prisma)
docker/       scripts do PostgreSQL de desenvolvimento
deploy/       empacotamento e scripts do servidor de produção
docs/         especificação, decisões e roteiros
```

## Produção

O sistema roda num Windows Server interno: IIS (site estático e proxy de `/api`), a API como serviço do Windows (NSSM) e PostgreSQL 17. O roteiro completo, da preparação do servidor ao backup, está em [docs/deploy-windows.md](docs/deploy-windows.md).

Para gerar o pacote de instalação (na raiz, com o banco de desenvolvimento no ar e tudo commitado):

```powershell
powershell -ExecutionPolicy Bypass -File deploy\empacotar.ps1
```
