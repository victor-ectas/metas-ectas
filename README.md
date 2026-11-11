# Sistema de Gestão de Metas

Aplicação web interna que substitui as planilhas de metas dos gestores: cadastro de metas e fórmulas, lançamento mensal das variáveis, cálculo de resultado, atendimento, pontuação e nota, com trava de meses fechados.

- Regras completas: [docs/especificacao.md](docs/especificacao.md)
- Instruções de desenvolvimento e plano passo a passo: [CLAUDE.md](CLAUDE.md)
- Decisões técnicas: [docs/decisoes.md](docs/decisoes.md)

## Pré-requisitos

- **Node.js 24 LTS** (versão exata em [.nvmrc](.nvmrc)).
- **pnpm** na versão de `packageManager` do [package.json](package.json). Instale com:

  ```sh
  corepack enable pnpm
  ```

  Sem permissão de administrador no Windows, instale o atalho numa pasta do usuário que esteja no `PATH`:

  ```sh
  corepack enable pnpm --install-directory "%APPDATA%\npm"
  ```

- **Docker Desktop**, para o PostgreSQL de desenvolvimento (`postgres:18.4-alpine`, porta 5433). A versão major deve ser a mesma do servidor de produção (16 ou superior).

## Como rodar

```sh
pnpm install           # instala as dependências e gera o client Prisma
cp .env.example .env   # preencha as senhas (o .env nunca vai para o git)
pnpm db:subir          # sobe o PostgreSQL no Docker (cria usuários e bancos na 1ª vez)
pnpm db:migrar         # aplica as migrações no banco de desenvolvimento
pnpm db:seed           # Administrador (SEED_ADMIN_EMAIL), setores, ciclo e feriados de exemplo
pnpm dev               # sobe api, jobs e web em modo desenvolvimento
```

### Banco de dados

O `docker-compose.yml` sobe um PostgreSQL só para desenvolvimento, com dois usuários:

| Usuário       | Uso                                       | Variável                                      |
| ------------- | ----------------------------------------- | --------------------------------------------- |
| `metas_owner` | Dono do esquema: migrações, seed e testes | `DATABASE_URL_MIGRACAO`, `DATABASE_URL_TESTE` |
| `metas_app`   | Aplicação: só lê e escreve dados          | `DATABASE_URL`                                |

e dois bancos: `metas` (desenvolvimento) e `metas_teste` (testes de integração). O `pnpm test` do pacote `@metas/prisma` aplica as migrações no `metas_teste` e roda cada teste numa transação desfeita, então **o PostgreSQL precisa estar no ar para o `pnpm verify` passar**.

Para mudar o esquema: edite `prisma/schema.prisma` e rode `pnpm db:migrar` (cria uma migração nova). Migrações já aplicadas não são editadas.

> Até os passos P08 (API) e P10 (web), `pnpm dev` ainda não sobe nenhum serviço.

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

Para rodar um script num pacote só: `pnpm --filter @metas/motor test`.

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
docs/         especificação, decisões e roteiros
```
