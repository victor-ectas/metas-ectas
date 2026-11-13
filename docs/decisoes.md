# Decisões técnicas

Registro curto (ADR) de toda decisão que não está no `CLAUDE.md` nem na especificação: biblioteca escolhida, versão fixada, padrão adotado ou desvio aprovado pelo desenvolvedor. Decisões não são apagadas; uma decisão nova pode substituir outra (status `Substituída por ADR-NNN`).

## Modelo

```md
## ADR-NNN — Título curto

- **Data:** dd/mm/aaaa
- **Status:** Proposta | Aceita | Substituída por ADR-NNN
- **Passo:** Pnn

**Contexto.** Qual problema ou escolha apareceu.

**Decisão.** O que foi decidido.

**Consequências.** O que muda, o que fica mais fácil ou mais difícil, o que revisar depois.
```

---

## ADR-001 — Versões fixadas com o catálogo do pnpm

- **Data:** 11/11/2026
- **Status:** Aceita
- **Passo:** P01

**Contexto.** O `CLAUDE.md` pede versões exatas, sem `^`. Vários pacotes do monorepo usam as mesmas ferramentas (TypeScript, Vitest).

**Decisão.** As versões ficam uma vez só no `catalog` do `pnpm-workspace.yaml`, sempre exatas, e os pacotes as referenciam com `"catalog:"`. Versões iniciais: Node 24.15.0 (`.nvmrc`, `engines`), pnpm 10.34.9 (`packageManager`), TypeScript 6.0.3, ESLint 10.14.0, `@eslint/js` 10.0.1, `typescript-eslint` 8.72.2, Prettier 3.10.0, Vitest 5.1.0, `@types/node` 24.19.2.

**Consequências.** Atualizar uma ferramenta é mudar uma linha. Dependências de runtime específicas de um pacote (NestJS, React etc.) também entram no catálogo quando forem compartilhadas.

## ADR-002 — TypeScript 6.0 em vez de 7.0

- **Data:** 11/11/2026
- **Status:** Aceita
- **Passo:** P01

**Contexto.** A versão mais recente do TypeScript é a 7.0.2, mas o `typescript-eslint` 8.72.2 só aceita `typescript >=4.8.4 <6.1.0`.

**Decisão.** Usar o TypeScript 6.0.3.

**Consequências.** Rever quando o `typescript-eslint` suportar a 7.x.

## ADR-003 — Formato de módulo por pacote

- **Data:** 11/11/2026
- **Status:** Substituída: resolução do `motor`/`tipos` pelo ADR-005; formato da `api`/`jobs` pelo ADR-011
- **Passo:** P01

**Contexto.** O `motor` e o `tipos` rodam no navegador e no servidor; a `web` usa Vite; a `api` usa NestJS, cujo padrão é CommonJS (decorators e metadados).

**Decisão.** `packages/motor`, `packages/tipos` e `apps/web` são ESM (`"type": "module"`, `moduleResolution: Bundler`). `apps/api` e `apps/jobs` seguem o padrão do NestJS: CommonJS com `module: NodeNext`. O Node 24 carrega pacotes ESM a partir de CommonJS (`require(esm)`). A forma como `api` e `web` consomem `motor` e `tipos` (código-fonte ou `dist`) é decidida no P02.

**Consequências.** Os arquivos de configuração do Vitest usam extensão `.mts` para serem ESM em qualquer pacote.

## ADR-004 — ESLint com checagem de tipos estrita

- **Data:** 11/11/2026
- **Status:** Aceita
- **Passo:** P01

**Contexto.** O `CLAUDE.md` pede ESLint flat com `typescript-eslint` e proíbe `eval`, `new Function` e similares.

**Decisão.** Configuração `strictTypeChecked` com `projectService`, mais `no-eval`, `no-new-func` e `@typescript-eslint/no-implied-eval` como erro. `pnpm lint` roda o ESLint e `prettier --check`. `CLAUDE.md` e `docs/especificacao.md` ficam fora do Prettier, para não reformatar os documentos.

**Consequências.** O lint é mais lento que sem tipos, mas pega `any` implícito, promessas soltas e afins.

## ADR-005 — Consumo dos pacotes internos pela condição `@metas/source`

- **Data:** 11/11/2026
- **Status:** Aceita
- **Passo:** P02

**Contexto.** `motor`, `api` e `web` importam `@metas/tipos` (e, mais tarde, `@metas/motor`). No desenvolvimento, a checagem de tipos, o ESLint e os testes devem ver o código-fonte na hora, sem build prévio. Em produção, a `api` e os `jobs` rodam no Node a partir do `dist`, e o Node não executa `.ts` dentro de dependências.

**Decisão.**

- Os pacotes internos declaram `exports` com uma condição própria: `"@metas/source": "./src/index.ts"`, depois `types` e `default` apontando para o `dist`.
- `tsconfig.base.json` liga `customConditions: ["@metas/source"]`; cada `tsconfig.build.json` desliga (`customConditions: []`), de modo que o build compila contra o `dist` dos pacotes de que depende. `pnpm -r run build` compila na ordem das dependências.
- O Vitest liga a mesma condição em `resolve.conditions` e `ssr.resolve.conditions`, repetindo as condições padrão do Vite (`module`, `browser`/`node`, `development|production`), porque o `vitest/config` não as exporta.
- `motor` e `tipos` passam de `moduleResolution: Bundler` para `NodeNext` (ESM). O compilador passa a exigir a extensão `.js` nos imports relativos, e o `dist` roda direto no Node, tanto via `import` (ESM) quanto via `require` (CommonJS da `api`, com o `require(esm)` do Node 24).
- `zod` 4.6.7 entra no catálogo como dependência de runtime do `tipos`.

**Consequências.** Mudanças no `tipos` aparecem na hora no editor e nos testes dos outros pacotes. Para rodar a `api` compilada (P08), o `tipos` precisa ter sido compilado antes, o que o `pnpm build` já garante. A condição precisa ser repetida no Vite da `web` (P10).

## ADR-006 — Detalhes da sintaxe de fórmulas não fixados na especificação

- **Data:** 11/11/2026
- **Status:** Aceita
- **Passo:** P03

**Contexto.** A seção 8.1 do `CLAUDE.md` define a linguagem, mas deixa alguns detalhes de leitura em aberto.

**Decisão.**

- **Nomes**: começam com letra ou `_` e seguem com letras, números e `_`, só ASCII (`PRESENÇAS` é recusado com "Caractere inválido"). `SETOR.VAR` tem um único ponto; função com prefixo de setor é erro.
- **Números**: exigem dígito antes do decimal (`.5` e `5.` são recusados com sugestão de `0,5`). Sem separador de milhar nem notação científica. O valor vai para a AST como texto com ponto (`"0.5"`), para ser lido com `Decimal`.
- **Vírgula**: é decimal quando está colada entre dígitos e o número ainda não tem decimal; senão separa argumentos. Consequência: `ARRED(3, 2)` (com espaço) tem dois argumentos, e `SE(A>0,1;0)` lê `0,1` como decimal.
- **Operadores**: só menos unário (sem `+` unário, como na 8.1). Comparações em cadeia (`A < B < C`) são aceitas, associativas à esquerda, como no Excel.
- **Mensagens**: no formato do exemplo da 8.1, sem ponto final, com posição a partir de 1 e "perto de" o trecho digitado (ou "no fim da fórmula").
- **Aninhamento**: no máximo 100 níveis de parênteses, funções ou menos unário, para não estourar a pilha.
- **AST**: cada nó guarda `posicao`, para o validador (P04) apontar onde está a variável ou função com problema.
- **Cobertura**: `@vitest/coverage-v8` 5.1.0 no `motor`, com limite de 100% (linhas, ramos, funções e instruções) em `pnpm test`.

**Consequências.** O validador do P04 confere aridade e nomes; a mensagem de aridade sugere `;` por causa da regra da vírgula.

## ADR-007 — Semântica do avaliador de fórmulas

- **Data:** 11/11/2026
- **Status:** Aceita
- **Passo:** P04

**Contexto.** A seção 8.1 do `CLAUDE.md` define funções, divisão por zero e variável vazia, mas não detalha precisão, avaliação do `SE`, verdade lógica nem casos-limite do `ARRED`.

**Decisão.**

- **Decimal**: `decimal.js` 10.6.0. O motor usa um clone próprio com 40 dígitos significativos, `ROUND_HALF_UP` e `toString()` sem notação científica, sem alterar a configuração global. `Decimal` de outra configuração ou cópia (ex.: Prisma) é recriado na entrada, porque no decimal.js as operações usam a configuração do construtor do operando.
- **Vazio**: se qualquer variável usada pela fórmula estiver vazia (ou ausente do escopo), o resultado é `null`, mesmo que ela esteja num ramo do `SE` não escolhido (RN-16 ao pé da letra).
- **Divisão por zero**: `null` com aviso `{ codigo: 'DIVISAO_POR_ZERO', posicao }`; o `null` se propaga por operadores e funções.
- **`SE` preguiçoso**: só o ramo escolhido é avaliado, para permitir `SE(B = 0; 0; A / B)` sem aviso. As demais funções avaliam todos os argumentos.
- **Verdade lógica**: diferente de zero é verdadeiro (como no Excel). `E`, `OU`, `NAO` e comparações devolvem 1 ou 0; `=` é igualdade decimal exata (a tolerância de 0,005 é só do operador `EQ` no atendimento).
- **`ARRED`**: meio para cima, afastando do zero nos negativos (`ARRED(-2,5; 0)` = -3); casas fracionadas truncadas; casas negativas arredondam à esquerda da vírgula; casas limitadas a ±1000.
- **Escopo e disponíveis**: chaves `CODIGO` (setor da meta) ou `SETOR.CODIGO`, como escritas na fórmula. Quem traduz para a variável real do banco é a API.
- **Validação**: devolve todos os erros (não só o primeiro), na ordem do texto; variável desconhecida repetida aparece uma vez. O erro de aridade sugere `;` quando algum argumento foi digitado com vírgula decimal.

**Consequências.** O mesmo código calcula na API e na prévia da web. A conversão de `Prisma.Decimal` para o `Decimal` do motor é automática.

## ADR-008 — Cálculo de metas: interface do motor e pontos não fixados na especificação

- **Data:** 11/11/2026
- **Status:** Aceita
- **Passo:** P05

**Contexto.** As seções 8.2 a 8.6 do `CLAUDE.md` definem o cálculo, mas deixam em aberto a forma dos dados e alguns casos-limite.

**Decisão.**

- **Interface orientada a dados**: `calcularMeta(meta, variaveis)` e `calcularCiclo({ metas, variaveis, atribuicoes })`. A meta traz a AST, o mapa "chave da fórmula → id da variável", período, objetivos (`0` = único), operador, tolerância, regra, peso interno e `submetas` aninhadas. Variáveis trazem acumulação e valores por mês. A API monta essas estruturas a partir do banco.
- **Saída sem arredondar**: valores em `Decimal` com precisão total; o arredondamento de exibição (2 casas na unidade; percentual com 2 casas em pontos percentuais) fica em `arredondarExibicao`, `arredondarAtendimento` e `arredondarPontos`. A memória de cálculo sai em textos e números, pronta para `jsonb`.
- **Atendimento da mãe** = Σ(pᵢ × atᵢ) / Σpᵢ. Com pesos somando 100% é exatamente a RN-27; dividir pela soma evita que 33,33% × 3 impeça a mãe de chegar a 100%.
- **Situação da mãe**: Sem dados se todos os componentes estão sem dados; Batida com atendimento composto = 1; senão Abaixo.
- **Regra efetiva**: operador FAIXA força tudo ou nada só em meta sem submetas; numa mãe vale a regra cadastrada sobre o atendimento composto.
- **Sem objetivo**: no mês, atendimento e situação mensais ficam `null`; no acumulado, atendimento 0, situação Abaixo (Fora da faixa no FAIXA) e aviso `SEM_OBJETIVO`. `validarMeta` impede salvar meta sem objetivo do último mês nem único.
- **Divisão por zero no acumulado** (fórmula sobre acumulados): acumulado vazio, situação Sem dados e aviso `DIVISAO_POR_ZERO`.
- **Variável não mapeada ou ausente**: tratada como vazia.
- **RN-23** vale só para meta pontuada (sem submetas e sem mãe) com operador diferente de FAIXA, e confere todos os objetivos informados.
- **Comparação de somas**: pesos internos com 2 casas em pontos percentuais (fração com 4 casas); pesos de bloco com 2 casas.
- **Validação de 2 níveis**: uma submeta com submetas gera só esse erro (não acusa os pesos dela).

**Consequências.** O mesmo código serve à API (P17) e à prévia da web (P19). A API precisa resolver os códigos simples da fórmula para as variáveis do setor da meta e os `SETOR.CODIGO` para as do outro setor.

## ADR-009 — Calendário de fechamento no motor

- **Data:** 11/11/2026
- **Status:** Aceita
- **Passo:** P06

**Contexto.** RN-33 a RN-36 definem dias úteis, fechamento no 15º dia útil de M+1 e reabertura, sempre em `America/Sao_Paulo`.

**Decisão.**

- **Luxon** 3.7.2 (`@types/luxon` 3.7.6) no `motor`. O fuso é a constante `ZONA_REGRAS = 'America/Sao_Paulo'` do motor, e não a variável `TZ_REGRAS`: a regra é de negócio e o mesmo código roda no navegador. Testado com o processo em UTC, Tóquio e Los Angeles.
- **Fechamento** = `endOf('day')` do 15º dia útil, ou seja, 23:59:59.999. A partir de 00:00:00.000 do dia seguinte o mês está fechado (CT-18).
- **Feriados** chegam como `AAAA-MM-DD`; data inválida lança `RangeError`, para um cadastro errado não mudar o prazo em silêncio. Mês seguinte com menos de 15 dias úteis também lança erro.
- **Mês corrente** é o de São Paulo: às 01:00 UTC de 01/11 ainda é outubro, e novembro é `FUTURO`.
- **Reabertura**: vale enquanto `agora ≤ validoAte` e antes de `canceladaEm`. O escopo (todos, setor, gestor) é filtrado por quem chama (API), e o motor só confere ano e mês. Reabertura não altera mês ainda aberto nem mês futuro.
- **`StatusMes`** (`ABERTO`, `FECHADO`, `REABERTO`, `FUTURO`) foi para `@metas/tipos`, porque a API devolve e a web exibe.
- **Instantes** aceitos como `Date`, `DateTime` ou texto ISO com fuso.

**Consequências.** A API (P18) chama `statusMes` em toda gravação (RN-35) com os feriados e as reaberturas do escopo do lançamento; o job (P22) só atualiza a exibição.

## ADR-010 — Banco de dados de desenvolvimento, Prisma 7 e usuários

- **Data:** 11/11/2026
- **Status:** Aceita; versão do PostgreSQL substituída pelo ADR-012
- **Passo:** P07

**Contexto.** O P07 pede PostgreSQL local, esquema Prisma, migração inicial com as regras em SQL, seed e testes de integração. A máquina já tem um PostgreSQL 18 nativo na porta 5432, e a versão de produção ainda não está definida.

**Decisão.**

- **PostgreSQL de desenvolvimento no Docker** (`docker-compose.yml`): `postgres:18.4-alpine`, porta 5433 só em 127.0.0.1, volume nomeado. A versão de produção é **pendência**: conferir antes do P16 e alinhar a imagem à mesma versão major.
- **Dois usuários**, criados pelo script de inicialização do contêiner: `metas_owner` (dono do esquema, roda migrações e testes; `CREATEDB` para o banco-sombra) e `metas_app` (aplicação; só `SELECT/INSERT/UPDATE/DELETE` por privilégios padrão). Bancos `metas` e `metas_teste`.
- **Variáveis novas** no `.env.example` (além da seção 11): `DATABASE_URL_MIGRACAO`, `DATABASE_URL_TESTE`, `POSTGRES_PORTA`, `POSTGRES_PASSWORD`, `METAS_OWNER_PASSWORD`, `METAS_APP_PASSWORD`. `DATABASE_URL` continua sendo o usuário da aplicação.
- **Prisma 7.10.1** (o `latest` do npm aponta para um RC da 8; fixada a última estável), com `prisma.config.ts`, generator `prisma-client` (ESM, saída em `prisma/src/generated`, gerado no `postinstall` e fora do git) e `@prisma/adapter-pg` 7.10.1 com `pg` 8.23.1. `dotenv` 18.0.10 e `tsx` 4.23.15 para config, seed e testes.
- **`prisma/` virou o pacote `@metas/prisma`** do workspace, no mesmo lugar da seção 4: esquema, migrações, seed, testes e `criarPrismaClient(url)` para a API (P08).
- **Ids gerados pelo banco** (`gen_random_uuid()`), para INSERT em SQL puro (seed, importação, testes) também funcionar.
- **Regras no banco** (SQL da migração): `CHECK` de mês, período, peso interno (0, 1], peso de atribuição (0, 100], tolerância ≥ 0, casas decimais 0–6, ano 2000–2100, e-mail em minúsculas, códigos no formato das fórmulas, escopo da reabertura; índices únicos parciais (um Corporativo, um ciclo ATIVO); trigger de 2 níveis (também mesmo ciclo da mãe e sem atribuição em submeta); trigger que bloqueia `UPDATE/DELETE/TRUNCATE` em `lancamento_historico` e `auditoria` para qualquer usuário; trigger que mantém `atualizado_em`.
- **`criado_por` e `atualizado_por`** são `uuid` sem chave estrangeira (evita dezenas de relações no Prisma); quem fez o quê fica na `auditoria`, que tem FK para `usuario`.
- **`importacao.status`** é texto por enquanto; vira enum no P24, quando o fluxo for detalhado. `importacao.modo` usa o enum `ModoImportacao` (GESTOR, CARGA_HISTORICA) da especificação 7.3.
- **Testes de integração** no `metas_teste`: o `globalSetup` roda `prisma migrate deploy` (não apaga nada); cada teste roda numa transação desfeita; os testes recusam qualquer banco cujo nome não termine em `_teste`.

**Consequências.** `pnpm verify` passa a exigir o PostgreSQL no ar (`pnpm db:subir`). O roteiro de produção (P16) precisa criar os mesmos dois usuários com os mesmos privilégios.

## ADR-011 — API em NestJS 12 (ESM), erros, logs e proteções

- **Data:** 11/11/2026
- **Status:** Aceita
- **Passo:** P08

**Contexto.** O ADR-003 pôs `api` e `jobs` em CommonJS por ser o padrão do NestJS. O NestJS 12 (12.4.2, versão atual) é publicado só em ESM.

**Decisão.**

- **NestJS 12.4.2 com `api` e `jobs` em ESM** (`"type": "module"`, `NodeNext`, imports com `.js`), igual a `motor` e `tipos`. Decorators com `experimentalDecorators` + `emitDecoratorMetadata`; nos testes, `unplugin-swc` 2.0.0 + `@swc/core` 1.16.22. Dev com `@nestjs/cli` 12.0.12 (`nest start --watch`, builder tsc).
- **Pacotes internos em runtime** vêm do `dist`: `@metas/prisma` ganhou build. O `pnpm dev` da raiz compila `tipos`, `motor` e `prisma` antes de subir os serviços.
- **Configuração**: schema Zod em `config/config.ts`; falta ou erro lista todos os problemas em português e a API não inicia. `.env` da raiz lido com `process.loadEnvFile` do Node, só se o arquivo existir (em produção as variáveis vêm do serviço do Windows). Nova variável opcional `LIMITE_ESCRITA_POR_MINUTO` (padrão 120).
- **Erros**: `ErroApi(codigo, mensagem, detalhes)` com status por código — 400 `VALIDACAO`, 401, 403, 404, 409 `CONFLITO_VERSAO`, **422 para regras de negócio** (`MES_FECHADO`, `MES_FUTURO`, `FORMULA_INVALIDA`, `PESOS_INCONSISTENTES`, `CICLO_ENCERRADO`, `IMPORTACAO_INVALIDA`), 429, 500. Filtro global converte também exceções do Nest, `ZodError` (campos em `detalhes.campos`), JSON malformado e erros inesperados (500 com `requestId` em `detalhes` e no texto, sem stack nem mensagem interna).
- **Código novo `MUITAS_REQUISICOES`** em `@metas/tipos` para o limite de taxa (a 5.3 lista os códigos iniciais).
- **Logs**: `nestjs-pino` 5.3.1 (pino 10.4.0, pino-http 11.0.0), JSON; `requestId` do cabeçalho `X-Request-Id` (se curto e simples) ou UUID, devolvido na resposta; serializadores só com id, método, URL e status — nunca cabeçalhos nem corpo.
- **Segurança**: `helmet` 8.3.0 (CSP completo em produção; desligado fora dela por causa da interface do Swagger); CORS só para `WEB_ORIGIN` (lista, sem refletir outras origens); `trust proxy = loopback` (IIS na mesma máquina); limite de taxa com `@nestjs/throttler` 6.7.1 só em POST/PUT/PATCH/DELETE, por IP.
- **OpenAPI** (`@nestjs/swagger` 12.1.1) em `/api/v1/docs` e `/api/v1/docs-json`, só fora de produção.
- **Saúde**: `GET /api/v1/saude` com `SELECT 1` (prazo 3 s); 200 `{ status: 'ok', verificacoes, em }` ou 503 `indisponivel` (corpo de saúde, não de erro). Pública por enquanto; continuará pública quando a autenticação entrar (P09).
- **Prisma na API**: `PrismaService extends PrismaClient`, conexão sob demanda (a API sobe com o banco fora e a saúde mostra 503).
- **pnpm**: scripts de instalação liberados só para `@prisma/engines`, `@swc/core`, `esbuild` e `prisma`; telemetria `@scarf/scarf` bloqueada.

**Consequências.** API e jobs no mesmo formato de módulo do resto do monorepo. Mudanças em `tipos`/`motor`/`prisma` exigem reiniciar o `pnpm dev` para a API enxergar o novo `dist` (os testes leem o código-fonte).

## ADR-012 — PostgreSQL 17 no desenvolvimento, igual à produção

- **Data:** 11/11/2026
- **Status:** Aceita (substitui a versão do PostgreSQL do ADR-010)
- **Passo:** ajuste do P07, depois do P08

**Contexto.** O ADR-010 deixou como pendência a versão do PostgreSQL de produção. O desenvolvedor confirmou: o servidor roda **PostgreSQL 17**. A seção 3 do CLAUDE.md pede a mesma versão major em desenvolvimento.

**Decisão.**

- Imagem do Docker trocada de `postgres:18.4-alpine` para **`postgres:17.11-alpine`** (última do 17). O volume monta em `/var/lib/postgresql/data`, o caminho dos dados até o 17 (o 18 usa `/var/lib/postgresql`).
- O volume do 18 foi apagado (`docker compose down -v`, com autorização) e recriado: dados do 18 não abrem no 17. Banco de desenvolvimento refeito com `db:subir`, `db:migrar` e `db:seed`.
- A migração `inicial` roda sem mudança no 17 (não foi editada nem recriada).
- Diferença encontrada nos testes: `ON DELETE RESTRICT` responde SQLSTATE **`23503`** (foreign_key_violation) no 17, e `23001` (restrict_violation) no 18. O teste passou a esperar o código do 17. Quando a API traduzir erros do banco, tratar `23503` como "registro em uso".

**Consequências.** Desenvolvimento, testes e produção na mesma versão major; backups `pg_dump` compatíveis. Quem já tinha o volume do 18 precisa recriá-lo (`docker compose down -v` e `pnpm db:subir`), apagando o banco local.

## ADR-013 — Autenticação (Entra ID), modo DEV e serviço de políticas

- **Data:** 11/11/2026
- **Status:** Aceita
- **Passo:** P09

**Contexto.** O P09 pede validação do JWT do Entra ID, modo DEV com trava de produção, provisionamento no primeiro acesso, `GET /me`, `PoliticasService` e o decorator `@Perfis(...)`. Alguns pontos não estão fixados na especificação.

**Decisão.**

- **`jose` 6.2.17** (seção 3), sem dependências próprias.
- **Guard global** (`AuthGuard`, depois do limite de taxa): toda rota exige login (especificação 10). Exceções explícitas: `@Publica()` (só a saúde) e `@PermiteInativo()` (só `GET /me`). `@Perfis(...)` é decidido por `PoliticasService.temPerfil`.
- **Validação do token**: RS256 pelo JWKS do tenant (`createRemoteJWKSet`, cache do jose, prazo de 5 s), emissor `https://login.microsoftonline.com/{tenant}/v2.0`, audiência, expiração com 60 s de tolerância de relógio. Exige `exp`, `oid` e `scp`: sem `scp` é token de aplicação ou ID token, que não servem para chamar a API. Falha ao buscar as chaves vira 500 (logado), não 401.
- **Audiência como lista** (`ENTRA_API_AUDIENCE`, separada por vírgula): em tokens v2 o `aud` é o ID do aplicativo (GUID), não o URI `api://metas`. Aceitar os dois evita depender de como o registro foi configurado; confirmar na homologação (P10).
- **Primeiro acesso**: procura pelo `oid`; senão, por um usuário pré-cadastrado pelo e-mail e ainda sem `oid` (é o caso do Administrador do seed e dos usuários cadastrados no P11), que é ligado ao `oid`; senão, cria como **Leitor inativo** (RF-02). Ligação e criação vão para a `auditoria` (`VINCULAR_ENTRA_ID`, `CRIAR_NO_PRIMEIRO_ACESSO`). E-mail vem de `email` ou `preferred_username`, em minúsculas. E-mail já ligado a outro `oid` ou token sem e-mail: 403, e só o Administrador resolve. Logins simultâneos não duplicam o usuário.
- **Usuário inativo** acessa só `GET /me` (confirmado pelo desenvolvedor); o resto responde 403 `SEM_PERMISSAO` com `detalhes.motivo = USUARIO_INATIVO`. Token expirado: 401 com `detalhes.motivo = TOKEN_EXPIRADO`, para a web renovar o login.
- **`GET /me`** devolve usuário, `todosOsSetores` (Admin e Diretoria) e setores: do Gestor, os que ele responde no ciclo ATIVO; do Leitor, os liberados. Schema `SessaoSchema` em `@metas/tipos`. As **pendências** (especificação 10.1) entram com os lançamentos (P18/P20).
- **Modo DEV**: só com `NODE_ENV=development` (a API não inicia com `AUTH_DEV=true` em `test` nem em `production`); `AUTH_DEV_EMAIL` obrigatório; o usuário simulado precisa existir no banco; o cabeçalho `X-Usuario-Dev` troca o usuário (liberado no CORS só nesse modo); aviso no log ao iniciar.
- **`PoliticasService` com funções puras**: quem chama carrega os dados do recurso (`MetaParaAcesso`, `VariavelParaLancamento`). Regras: cadastros, metas e carga histórica só Admin; ver meta conforme 7.5, e a **submeta é visível a quem vê a meta-mãe** (confirmado pelo desenvolvedor); histórico: Admin e Diretoria todos, Gestor das próprias, Leitor não; `podeLancar` só o Gestor responsável pelo lançamento (`responsavelPeloLancamento`: no Corporativo, o da variável; nos outros setores, o do setor no ciclo). Trava do mês e reabertura ficam no P18. Usuário inativo não pode nada.
- **Testes da API** usam o banco de testes real com tokens assinados por uma chave gerada no teste (JWKS local, sem rede). Os dados criados são marcados (e-mail `@api-teste.local`, setores `TAPI_*`, ciclos 2097/2098) e apagados antes e depois; para apagar a auditoria, a limpeza desliga o trigger de somente inclusão só dentro da sua transação, com o dono do esquema, só no banco `_teste`. A API passa a aplicar as migrações no banco de testes no `globalSetup`, como o `@metas/prisma`.

**Consequências.** O `.env` local precisa de `AUTH_DEV=true` (com `AUTH_DEV_EMAIL` cadastrado) ou das variáveis do Entra ID para a API subir. O cadastro de usuários (P11) pré-cadastra pelo e-mail, sem `oid`.

## ADR-014 — Web base: React 18, MUI 9, React Router 7, MSAL e identidade visual

- **Data:** 12/11/2026
- **Status:** Aceita
- **Passo:** P10

**Contexto.** O P10 cria a web: Vite + React + MUI, layout responsivo, rotas, MSAL, cliente HTTP, TanStack Query, formatadores pt-BR e a página Início. A seção 3 fixa React 18; algumas bibliotecas atuais já exigem React 19.

**Decisão.**

- **Versões** (no `catalog`): React 18.3.1, Vite 8.3.8, `@vitejs/plugin-react` 6.3.0, MUI 9.5.0 (+ Emotion 11.14), TanStack Query 5.107.1, `@azure/msal-browser` 5.29.0 e `@azure/msal-react` 5.8.1, `@fontsource/montserrat` 5.3.0. Testes: Testing Library (react 16.3.3, dom 10.4.2, user-event 14.6.10, jest-dom 7.0.1) e jsdom 31.0.0. Lint: `eslint-plugin-react-hooks` 7.1.1 (`recommended-latest`) na web.
- **React Router 7.18.5, não o 8**: o 8 exige React 19.
- **`react-is` fixado em 18.3.1** (`overrides`): o MUI 9 depende do `react-is` 19, que não reconhece elementos do React 18; é a orientação do MUI para quem usa React 18.
- **React Hook Form e ECharts** ficam para os passos que tiverem formulário (P11) e gráfico; o P10 não usa nenhum dos dois.
- **Pacotes internos pelo código-fonte**: o Vite resolve `@metas/*` pela condição `@metas/source` no desenvolvimento e no build (ele compila o TypeScript); a web não precisa do `dist` dos pacotes. A web usa o `Decimal` e o `arredondarExibicao` do motor: um só lugar para a regra de arredondamento (5.4).
- **Build com `NODE_ENV=production`**: o Vite aplica o `NODE_ENV` do `.env` da raiz (que é da API, `development`) ao build e empacotava o React de desenvolvimento. O script de build fixa `NODE_ENV=production`; para a mesma sintaxe funcionar no Windows, o pnpm usa o `shellEmulator`. Pacote principal: ~600 KB (~190 KB comprimidos), aceitável na rede interna (RNF-03); aviso de tamanho em 800 KB; quebrar por rota quando as telas crescerem.
- **Configuração** (`src/config.ts`): `VITE_*` validadas com Zod; sem as do Entra ID a web mostra "Sistema mal configurado" em vez de quebrar. `VITE_API_URL` vazio = `/api/v1` (mesmo endereço, atrás do IIS).
- **Modo DEV só no servidor do Vite**: `VITE_AUTH_DEV` vale só quando `import.meta.env.DEV`; o build de produção ignora a variável e o Vite elimina o módulo `auth/dev` e o seletor de usuário (conferido: nenhum vestígio no `dist`). O usuário simulado (cabeçalho `X-Usuario-Dev`) fica no `localStorage` e se troca pelo chip "DEV" da barra superior; trocar descarta o cache de consultas.
- **Entra ID**: Authorization Code + PKCE por **redirecionamento** (pop-up se perde no celular), `MsalAuthenticationTemplate` leva direto ao login, cache em `sessionStorage` (padrão do MSAL), `acquireTokenSilent` com redirecionamento quando exige interação. Um 401 com `TOKEN_EXPIRADO` refaz o login; outros 401 aparecem na tela, para não entrar num ciclo de redirecionamentos se o registro do aplicativo estiver errado.
- **Cliente HTTP**: valida a resposta com o schema de `@metas/tipos`; erro no formato 5.3 vira `ErroApi` (código, mensagem, detalhes, status); sem rede ou resposta fora do formato (ex.: página do IIS) viram `ERRO_INTERNO` com mensagem própria em português (`detalhes.motivo` = `SEM_CONEXAO` ou `RESPOSTA_INESPERADA`). Consultas não repetem erros 4xx.
- **Layout**: menu lateral fixo a partir de 900 px (`md`) e gaveta abaixo disso (celular e tablet); itens por perfil conforme a especificação 10.2, e o usuário inativo só vê o Início. As telas ainda não feitas têm rota com aviso "em construção (passo Pxx)". A tela **Histórico** da especificação 10.2 não tem passo no plano e ficou fora do menu.
- **Identidade visual** a partir do site da empresa (ectas.com.br): azul-marinho `#002B49` (primária), azul `#0073A8` (secundária), texto `#2F2E2E`, fundo `#F4F6F8`, fonte Montserrat servida pelo próprio sistema (sem CDN). Cores de texto e botão com contraste AA. Alvos de toque de 44 px. Trocar os tokens em `app/tema.ts` se houver manual de marca.
- **Formatação** (`src/formatacao`): número, moeda, percentual (fração → `79,91%`), SIM/NÃO, valor por unidade (`2,64 dias`) e datas `dd/mm/aaaa` no fuso de São Paulo (data sem hora não muda de dia). Vazio vira `—` (RN-08); nunca `-0,00`.

**Consequências.** A web roda inteira no modo DEV sem Entra ID. O critério "login real no Entra ID em homologação" depende do registro do aplicativo (IDs no `.env` e a URI de redirecionamento SPA cadastrada).

## ADR-015 — Identidade visual da ECTAS na web

- **Data:** 12/11/2026
- **Status:** Aceita (substitui a parte de identidade visual do ADR-014)
- **Passo:** ajuste do P10, a pedido do desenvolvedor

**Contexto.** O desenvolvedor pediu o sistema "com a carinha da ECTAS": cores, fontes e elementos de água do site oficial (ectas.com.br). O levantamento usou o firecrawl (extração de marca e captura de tela inteira do site) e o arquivo original do logotipo.

**Decisão.**

- **Cores do logotipo oficial** (três ondas): marinho `#13314D`, azul `#0073A8`, turquesa `#59BDBC`. Complementos do site: turquesa claro `#D4EFEE`, fundo "espuma" `#EEF7F7`, borda `#D3E6E8`, texto `#2F2E2E` e texto secundário `#4A6274`. Ações e foco em azul; turquesa só como decoração e indicador sobre fundo claro (contraste 2,3:1) e como texto apenas sobre o marinho (5,9:1).
- **Fonte**: Montserrat em todo o sistema, como no site (títulos 700, corpo 400), servida pelo próprio sistema; números tabulares em toda a página (sistema de números).
- **Logotipo**: gerado do PNG oficial (2331×1470) em `apps/web/src/assets/`: símbolo colorido, símbolo e nome em branco (para o marinho). Imagens com o dobro do tamanho exibido. Favicon e ícone do iPhone a partir do símbolo.
- **Elementos de água** (um só elemento marcante, como no site): faixa azul no topo do Início com a marca d'água das ondas do logotipo e borda ondulada turquesa; as três ondas do logotipo no pé do menu lateral, com o slogan "Ninguém cuida da ÁGUA como nós."; indicador turquesa ("nível de água") no item do menu da página atual.
- **Layout**: menu lateral marinho (como o rodapé do site) fixo no desktop e em gaveta no celular; barra superior branca no desktop (nome e perfil do usuário) e marinho no celular (com o logotipo). Conteúdo com largura máxima de 1120 px.
- **Movimento**: só na tela de carregamento (o símbolo sobe e desce devagar), desligado com `prefers-reduced-motion`.
- **Sem**: degradês decorativos, rótulos em caixa alta (o site usa muito, mas prejudica a leitura num sistema) e animações de entrada.
- **Diretrizes de interface** (Vercel Web Interface Guidelines) conferidas: foco visível (`:focus-visible` azul; turquesa sobre o marinho), imagens com largura e altura, `aria-hidden` nas ondas e ícones decorativos, `text-wrap: balance` nos títulos, `overscroll-behavior: contain` na gaveta, `touch-action: manipulation`, áreas seguras do celular (`viewport-fit=cover` + `env(safe-area-inset-*)`), `theme-color` igual à barra do celular, `translate="no"` na marca. Desvio consciente: os números são formatados à mão sobre `Decimal` em vez de `Intl.NumberFormat`, que exigiria converter para `number` (5.4).

**Consequências.** Os tokens ficam em `apps/web/src/app/tema.ts` (`CORES`); um manual de marca, se aparecer, muda só esse arquivo e os PNGs de `assets/`. O logotipo é da empresa e fica no repositório interno.

## ADR-016 — Cadastros básicos: regras, erros e componentes da web

- **Data:** 12/11/2026
- **Status:** Aceita
- **Passo:** P11

**Contexto.** O P11 pede API e telas de usuários, setores, ciclos, feriados, responsáveis por setor no ciclo e setores do Leitor, só para o Administrador e com auditoria. Algumas regras não estavam fixadas; o desenvolvedor decidiu em 12/11/2026.

**Decisões do desenvolvedor.**

- **Exclusão**: usuários e setores podem ser inativados e também excluídos, mas só sem nenhum registro associado. O setor Corporativo nunca é inativado nem excluído. Setores liberados ao Leitor são configuração dele e saem junto na exclusão. Quem já entrou no sistema tem registro associado (a auditoria do primeiro acesso) e só pode ser inativado.
- **Feriados**: alteração que mude o prazo de fechamento de um mês já fechado é recusada (`MES_FECHADO`). Regra exata: um feriado no mês X conta dias úteis do fechamento do mês X−1; compara-se o prazo antes e depois da mudança e, se mudou e o menor dos dois já passou, recusa. Feriado em fim de semana ou depois do prazo não muda nada e é aceito. Corrigir o passado é com a reabertura (P23).
- **Gerente Geral**: só no perfil Diretoria; pode haver vários.
- **Responsável por setor**: só Gestor ativo. Responsável (por setor ou por variável do Corporativo) em ciclo não encerrado não pode ser inativado nem mudar de perfil antes de ser trocado.

**Decisões técnicas.**

- **Rotas** (só Admin, `@Perfis(ADMIN)` decidido pelo `PoliticasService`): `GET/POST /usuarios`, `GET/PUT/DELETE /usuarios/{id}`, `PUT /usuarios/{id}/setores-leitor`, `GET/POST /setores`, `PUT/DELETE /setores/{id}`, `GET/POST /ciclos`, `GET/PUT /ciclos/{id}/responsaveis`, `GET /feriados?ano`, `POST /feriados`, `PUT/DELETE /feriados/{id}`. `GET /usuarios` paginado com busca, perfil e situação; os outros são listas pequenas.
- **Códigos de erro novos** em `@metas/tipos`: `JA_EXISTE` (409, índice único) e `EM_USO` (409, chave estrangeira na exclusão). `traduzirErroBanco` lê o nome do índice que o Prisma 7 com adapter `pg` devolve (`meta.driverAdapterError.cause.constraint.index`) e dá a mensagem em português; o nome do índice não vai para a resposta (5.3).
- **Auditoria**: `AuditoriaService.registrar(tx, autor, …)` grava na mesma transação; `@AutorDaRequisicao()` dá o usuário e o IP. Entidades `usuario`, `setor`, `ciclo`, `feriado` e `setor_responsavel` (id `cicloId:setorId`).
- **Proteções extras**: o Administrador não pode se inativar, tirar o próprio perfil de Admin nem se excluir; superior imediato não pode ser o próprio usuário nem criar ciclo na hierarquia; código e "Corporativo" de um setor não mudam depois que ele tem variáveis ou metas (o código está nas fórmulas e o Corporativo define o bloco, RN-02).
- **API depende do motor** (`@metas/motor`) para calcular o prazo de fechamento na trava de feriados.
- **Web**: React Hook Form 7.92.0 + `@hookform/resolvers` 7.0.6 com os mesmos schemas Zod da API; erros de validação da API (`detalhes.campos`) vão para o campo certo. Componentes reutilizáveis: `ListaResponsiva` (tabela no desktop, cartões no celular), `CabecalhoPagina`/`CabecalhoSecao`, `DialogoConfirmacao` (toda exclusão pede confirmação), `ProvedorAvisos` (confirmação com `role="status"`), `SeloSituacao`, campos `CampoTexto`/`CampoSelecao`/`CampoChave`. A aba da tela fica na URL (`/cadastros?aba=setores`).
- **Atenção no MUI**: em `sx`, o número `1` em `width` vale 100%; use `'1px'`/`'1%'`.

**Consequências.** As próximas telas (variáveis, metas, lançamentos) reutilizam os mesmos componentes e o mesmo padrão de erro. Mudança em `@metas/tipos` ou `@metas/motor` exige reiniciar o `pnpm dev` para a API (ADR-011).

## ADR-017 — Variáveis: travas, renomeação nas fórmulas e testes em sequência

- **Data:** 12/11/2026
- **Status:** Aceita
- **Passo:** P12

**Contexto.** O P12 pede API e tela de variáveis por ciclo e setor, a lista "usada por" e a renomeação do código atualizando as fórmulas (RF-21), numa transação. A especificação não diz o que pode mudar numa variável já em uso, nem quem pode ser responsável por variável do Corporativo; o desenvolvedor decidiu em 12/11/2026.

**Decisões do desenvolvedor.**

- **Travas**: com lançamentos ou usada em alguma meta, a variável não muda de **tipo, acumulação nem setor** (mudariam o significado dos valores já lançados). Nome, código (com RF-21), origem, casas decimais, responsável e situação continuam editáveis.
- **Inativar**: recusado (`EM_USO`, com a lista das metas) enquanto uma meta **ativa** usa a variável.
- **Responsável próprio** (RN-07): só no Corporativo, só **Gestor ativo** (a Diretoria foi considerada e descartada, porque a tabela 7.5 diz que a Diretoria não lança). É opcional no cadastro; a consistência do ciclo (P15) avisa e impede ativar.
- **Exclusão**: só sem registros associados (lançamentos ou metas), como no ADR-016; nos outros casos, inativar.

**Decisões técnicas.**

- **Rotas** (só Admin): `GET/POST /ciclos/{id}/variaveis` (`?setor=`), `GET/PUT/DELETE /ciclos/{id}/variaveis/{vid}`. A resposta traz `setorCodigo`, `responsavelNome`, `temLancamentos` e `usadaPor` (metas de `meta_variavel`). Ciclo `ENCERRADO` recusa alterações (`CICLO_ENCERRADO`, RN-39); ciclo ativo aceita (o recálculo vem no P17).
- **Renomeação (RF-21)**: `renomearVariavel(formula, {setorDaMeta, setorDaVariavel, antigo, novo})` no motor, pelos tokens e não por busca de texto: troca `ANTIGO` nas metas do setor da variável e `SETOR.ANTIGO` em qualquer setor, sem tocar em funções nem em nomes parecidos (`ANTIGO_2`), e preserva o resto do texto como foi digitado. A API reescreve `formula_texto`, regrava `formula_ast` (`parse` do motor), sobe a `versao` da meta e audita cada meta (`RENOMEAR_VARIAVEL`), tudo na mesma transação da variável; se o novo código já existe, nada muda.
- **Nomes reservados**: o código da variável não pode ser nome de função das fórmulas, inclusive as da Fase 2 (`SE`, `E`, `OU`, `NAO`, `ARRED`, `MIN`, `MAX`, `ABS`, `ANTERIOR`, `META`), para não confundir quem lê a fórmula.
- **SIM/NÃO** é gravado sempre com 0 casas decimais (RN-10).
- **Web**: página `/variaveis` com seletor de ciclo (`SeletorCiclo`, extraído da aba de ciclos), filtro por setor e busca no navegador (a lista de um ciclo é pequena), lista com o código completo `SETOR.CODIGO` e "Usada por"; diálogo com os campos travados explicados ("Fixo: a variável já tem lançamentos"), aviso de quantas fórmulas mudam ao trocar o código e responsável só quando o setor é o Corporativo. `CampoSelecao` com opção vazia passa a mostrá-la escrita (`displayEmpty`).
- **Testes dos pacotes em sequência** (`pnpm -r --workspace-concurrency=1 run test`): `@metas/prisma` e `@metas/api` usam o mesmo banco de teste e corriam juntos. Um ciclo ATIVO gravado por um teste da API derrubava o teste "no máximo um ciclo ATIVO" do Prisma (que agora também neutraliza ciclos ativos dentro da própria transação), e a carga de vários vitest ao mesmo tempo estourava timeouts da web. O `pnpm test` leva cerca de 75 s.

**Pendência conhecida.** O processo de teste da API cai às vezes no Windows com o código `0xC0000409` (cerca de 1 em 10 execuções do `cadastros.test.ts`), sem mensagem, sem relatório do Node e em pontos diferentes. **Já acontecia no código do P11** (conferido com `git stash`), acontece com e sem os servidores de dev e é pior com `--pool=threads`. Não é teste errado: rodar de novo passa. Investigar à parte (atualização do Node 24, Prisma/adapter `pg`, swc).

**Consequências.** O P13 grava a AST com o mesmo `parse` e deriva `meta_variavel` dela; a renomeação depende disso. Mudança em `@metas/tipos` ou `@metas/motor` continua exigindo reiniciar o `pnpm dev` (ADR-011).

## ADR-018 — Metas: salvar a árvore inteira, atribuições e exclusão

- **Data:** 12/11/2026
- **Status:** Aceita
- **Passo:** P13

**Contexto.** O P13 pede o CRUD de metas com submetas, objetivos e atribuições, validando fórmula e configuração com o motor, gravando a AST e `meta_variavel`, subindo a versão e auditando. A especificação não fixa a quem a meta departamental é atribuída, quem pode responder por ela nem o que é "ter lançamentos" (RF-18); o desenvolvedor decidiu em 12/11/2026.

**Decisões do desenvolvedor.**

- **Atribuição**: a meta departamental tem exatamente uma atribuição, ao gestor responsável por ela. Só a meta do Corporativo tem várias (RN-05), cada uma com seu peso.
- **Responsável** (RN-06): qualquer Gestor ativo. A tela (P14) sugere o responsável do setor no ciclo; se for outro, a consistência (P15) avisa.
- **Excluir** (RF-18): só se nenhuma variável usada pela meta ou pelas submetas tem valor lançado (lançamento vazio não conta, RN-08). Senão, inativar. O mesmo vale para remover uma submeta.

**Decisões técnicas.**

- **Meta salva inteira**: `POST /ciclos/{id}/metas` e `PUT /metas/{id}` recebem a meta-mãe com as submetas, os objetivos e as atribuições, numa transação. Os pesos internos só fecham 100% no conjunto (RF-13), então salvar submeta por submeta deixaria estados inválidos no meio. As rotas separadas `PUT /metas/{id}/objetivos` e `/atribuicoes` da especificação 10.1 ficam cobertas pelo PUT inteiro. Submeta com `id` é alterada, sem `id` é criada, e a que sumiu da lista é removida.
- **Controle otimista**: o `PUT` leva a `versao` lida. Diferente da atual dá `CONFLITO_VERSAO` (409, com `versaoAtual`), e a gravação usa `updateMany where versao` para fechar a corrida.
- **Validação ao salvar**: cada fórmula passa pelo `validar` do motor contra as variáveis **ativas** do ciclo (`CODIGO` do setor da meta e `SETOR.CODIGO` de qualquer setor). Erros vêm como `FORMULA_INVALIDA`, com a lista de `{ meta, mensagem, posicao }`. Depois vem o `validarMeta` (período, objetivo do último mês, tolerância da faixa, RN-23, 2 níveis, período da submeta, pesos internos), que devolve `VALIDACAO` ou `PESOS_INCONSISTENTES`. Submeta inativa não entra na soma dos pesos internos nem no cálculo.
- **Contrato**: objetivo único (só mês 0) **ou** mensal (meses dentro do período), sem misturar. Peso da atribuição em pontos (0 < peso ≤ 100); peso interno como fração (0 < p ≤ 1). Código da meta único no ciclo, entre meta e submetas. Submeta com `submetas` é recusada com a mensagem do RN-26 (o trigger do banco continua como última proteção).
- **Submeta herda** ciclo, setor, responsável e a regra de pontuação da mãe (RN-29; a regra não se aplica a ela) e não tem atribuição.
- **Leitura conforme o perfil**: `GET /ciclos/{id}/metas` (com `?setor=&gestor=`) e `GET /metas/{id}` são abertos a todo usuário ativo, filtrados pelo `PoliticasService.podeVerMeta`. Escrita e `POST /formulas/validar` são só do Administrador.
- **`POST /formulas/validar`** (RF-17): devolve os erros com posição, as variáveis usadas (id, chave, nome, tipo) e, com `valores`, o resultado de teste. Vazio ou divisão por zero dão resultado nulo, com o aviso no segundo caso.
- **Auditoria**: um registro por operação na meta-mãe (`CRIAR`, `ALTERAR`, `EXCLUIR`), com a árvore inteira antes e depois.

**Pendência (continua a do ADR-017).** A queda `0xC0000409` dos testes da API aparece com mais frequência conforme crescem os arquivos de teste. Descartados até aqui: arquivo sem banco nem Nest (0 em 15), Prisma sozinho no Node com milhares de consultas e 250 clients (0 em 18), servidores de dev e transports do pino. Fica a combinação do worker do Vitest com o Nest, o express ou o supertest; investigar num passo próprio.

**Consequências.** O editor (P14) monta e envia a árvore inteira e usa `POST /formulas/validar` para o teste com valores. O P15 usa as mesmas atribuições para conferir os pesos por gestor (RN-03).

## ADR-019 — Testes da API com conexões reaproveitadas (queda 0xC0000409 no Windows)

- **Data:** 12/11/2026
- **Status:** Aceita
- **Passo:** correção entre P13 e P14

**Contexto.** Desde o P11, o processo de teste da API caía às vezes no Windows com o código `0xC0000409`, sem mensagem e sem relatório do Node (ADR-017 e ADR-018). Com mais arquivos de teste, chegou a derrubar cerca de metade das rodadas completas.

**Investigação** (cada experimento repetido de 10 a 15 vezes):

| Experimento                                                  | Quedas   |
| ------------------------------------------------------------ | -------- |
| Teste sem banco e sem Nest                                   | 0/15     |
| Prisma sozinho no Vitest (milhares de consultas)             | 0/10     |
| `jose` sozinho (chaves RSA, assinar e verificar)             | 0/10     |
| Nest subindo e fechando, sem requisições                     | 0/10     |
| HTTP puro + supertest, sem banco                             | 0/10     |
| Nest + supertest numa rota sem banco                         | 0/10     |
| Nest + supertest em `/saude` (consulta o banco)              | 1 a 2/10 |
| HTTP puro + supertest + uma consulta Prisma por requisição   | 2/10     |
| O mesmo com o `dist` do Prisma (sem a transformação do Vite) | 3/10     |
| O mesmo no Node puro, fora do Vitest                         | 0/10     |
| O mesmo num processo filho com `fork` e IPC, fora do Vitest  | 1/12     |
| O mesmo com o servidor escutando uma vez só (porta fixa)     | 3/15     |
| **O mesmo com conexões HTTP reaproveitadas (keep-alive)**    | **0/15** |

**Causa.** É um defeito do Node 24.15 no Windows, não do código do sistema. Um processo filho com canal IPC (é assim que o Vitest roda os testes) que abre e fecha milhares de conexões TCP, ao mesmo tempo que fala com o PostgreSQL, morre de forma nativa. O supertest abria uma conexão nova por requisição (e, com `request(app.getHttpServer())`, também um servidor novo).

**Decisão.** Nos testes da API, `criarApp` sobe a aplicação uma vez por arquivo (`app.listen(0, '127.0.0.1')`), e o helper `cliente(app)` faz as requisições pelo endereço, com um `http.Agent` keep-alive compartilhado. Todos os `request(app.getHttpServer())` viraram `cliente(app)`. Nada no código da aplicação mudou.

**Resultado.** 8 rodadas completas da API (178 testes) sem nenhuma queda, e dois `pnpm verify` seguidos verdes. Uma falha isolada do teste "primeiro acesso simultâneo" apareceu uma vez logo depois da troca e não se repetiu em mais de 50 execuções. Um teste de estresse com 300 primeiros acessos simultâneos (10 por vez) deu 200 em todos; o teste agora mostra o código do erro caso volte a falhar.

**Consequências.** Testes novos da API usam `cliente(app)`, nunca `request(app.getHttpServer())`. Quando houver uma versão nova do Node 24 LTS, vale repetir o experimento "HTTP + Prisma sem keep-alive" para ver se o defeito foi corrigido.

## ADR-020 — Editor de metas na web

- **Data:** 12/11/2026
- **Status:** Aceita
- **Passo:** P14

**Contexto.** O P14 pede a lista de metas e o editor em 5 etapas (o que é; variáveis; fórmula com chips e teste; acumulação e período; objetivo, operador, peso e pontuação), com a frase "Bate quando…", submetas com a soma dos pesos ao vivo e a prévia pelo motor no navegador. O protótipo citado na especificação como referência visual não está no repositório; o desenho segue a identidade da ECTAS (ADR-015).

**Decisões técnicas.**

- **Rotas**: `/metas` (lista por ciclo, com filtros de setor, gestor e busca), `/metas/nova?ciclo=` e `/metas/:id`. Ciclo encerrado abre só para consulta.
- **Um formulário para a árvore**: um único `useForm` com `raiz` e `submetas[]`, com os mesmos campos de cálculo (`CamposCalculo`). Uma barra de "partes da meta" escolhe o que está sendo editado (meta principal ou submeta), e as 5 etapas valem para a parte escolhida. A soma dos pesos internos (submetas ativas, mais o resultado próprio da mãe quando há fórmula) aparece ao vivo, dizendo quanto falta ou passou.
- **Números como foram digitados**: o formulário guarda texto em pt-BR (percentual de 0 a 100), e `paraEntrada` converte com `Decimal` para o formato da API (ponto decimal, percentual como fração). Objetivos mensais ficam numa lista de 12 posições. Antes de enviar, os problemas de digitação e os do `MetaEntradaSchema` aparecem juntos, com o nome da parte e do campo. O corpo enviado é a saída do schema (código em maiúsculas).
- **Prévia com o motor**: a etapa Fórmula valida ao vivo com `validar` (o mesmo da API), mostra os erros em português com a posição e testa com valores pelo `avaliar` (percentual digitado de 0 a 100; vazio e divisão por zero dão resultado vazio). Os chips inserem variáveis, operadores e funções na posição do cursor.
- **Frase-resumo** (`fraseBateQuando`, `fraseVale`): funções puras, testadas com CT-01, CT-03, CT-04 e CT-16; a do resultado acompanha a parte editada.
- **Regras na tela** (a API decide): responsável sugerido pelo do setor no ciclo; meta departamental com uma atribuição só, ao responsável (a tela mantém isso sozinha); faixa sempre tudo ou nada; aviso de RN-23 com objetivo ≤ 0; aviso quando uma razão de SOMAs não usa "fórmula sobre os acumulados".
- **Salvar com `mutateAsync`**: depois de salvar, a meta recarrega com a versão nova e o editor é remontado (a `key` inclui a versão). Os callbacks passados a `mutate` de um componente desmontado não são chamados, e a tela não voltava para a lista. Isso foi visto no navegador real e coberto por um teste que atrasa a recarga das variáveis, como no navegador.
- **Responsivo**: no desktop, Stepper com as 5 etapas e o resumo fixo à direita (≥ 1200 px); no tablet e no celular, "Etapa X de 5" e o resumo abaixo. Conferido em 1440, 768 e 360 px, sem rolagem horizontal. No MUI 9, os botões do Stepper têm papel `tab` (dentro de `tablist`).

**Consequências.** O fetch falso dos testes da web aceita respostas que demoram (promessa). A tela de consistência (P15) reaproveita as atribuições e os pesos. Duas metas de exemplo (FISCAL_PRAZO e FAB_ENGAJAMENTO, com 5 submetas) ficaram no banco de dev.

## ADR-021 — Consistência, ativação e encerramento do ciclo

- **Data:** 12/11/2026
- **Status:** Aceita
- **Passo:** P15

**Contexto.** O P15 pede o painel de consistência do ciclo, a ativação bloqueada quando houver problema e o encerramento gravando `nota_fechamento`. A especificação não diz o que fazer com dois ciclos ativos na virada do ano, quando o ciclo pode ser encerrado, nem quais problemas impedem a ativação e quais só avisam. O desenvolvedor decidiu os três pontos.

**Decisões do desenvolvedor (12/11/2026).**

- **Um ciclo ativo por vez**: ativar o ciclo novo exige o anterior encerrado. O índice único `ciclo_unico_ativo` continua valendo. Na prática, o ciclo N+1 só é ativado no fim de janeiro, depois do fechamento de dezembro do ciclo N.
- **Encerrar** só um ciclo ativo, depois do prazo de dezembro (15º dia útil de janeiro, 23:59:59 em America/Sao_Paulo) e sem reabertura em vigor em nenhum mês. Não se desfaz.
- **Bloqueiam a ativação**:
  - pesos do gestor fora de 50/50 ou 100 (RN-03, CT-17);
  - regras da meta pelo `validarMeta`: pesos internos ≠ 100%, falta de objetivo e outras;
  - fórmula que não valida mais contra as variáveis ativas;
  - meta ativa sem atribuição;
  - responsável, gestor atribuído ou responsável de setor/variável que deixou de ser Gestor ativo;
  - variável do Corporativo sem responsável;
  - setor com variáveis ou metas no ciclo sem responsável.
- **Só avisam**:
  - responsável da meta departamental diferente do responsável do setor;
  - Gestor ativo sem nenhuma meta;
  - setor ativo vazio e sem responsável;
  - ciclo sem metas.

**Decisões técnicas.**

- **Rotas** (só Administrador):
  - `GET /ciclos/{id}/consistencia` devolve o ciclo, `podeAtivar`, `motivoNaoAtivar`, os pesos por gestor (Corporativo, Departamental, total, `ok`), os problemas (bloqueios antes dos avisos, cada um com tipo, gravidade, código de erro equivalente e a meta, variável, setor ou usuário envolvido) e a situação do encerramento.
  - `POST /ciclos/{id}/ativar` e `POST /ciclos/{id}/encerrar` respondem 200 com o ciclo.
- **Códigos de erro novos** (422):
  - `CICLO_INCONSISTENTE`: ativar com bloqueios. `detalhes.problemas` traz a lista.
  - `STATUS_CICLO_INVALIDO`: já ativo, outro ativo, rascunho que não encerra, dezembro ainda aberto ou reabertura em vigor.
  - O ciclo encerrado continua respondendo `CICLO_ENCERRADO`.
- **Ativação** reavalia o painel dentro da transação, muda o status com `where status = RASCUNHO` e audita (`ATIVAR`).
- **Encerramento** calcula o ciclo inteiro com o motor (`calcularCiclo`) a partir de `carregarCiclo` (`apps/api/src/resultados/carregar-ciclo.ts`): metas e submetas ativas, atribuições, AST gravada e lançamentos.
  - Grava uma linha de `nota_fechamento` por gestor e bloco: pontos com 6 casas e, em `dados`, o peso total e cada meta com peso, pontos, acumulado, objetivo, atendimento e situação.
  - Muda o status, grava `encerrado_em`/`encerrado_por` e audita (`ENCERRAR`), tudo na mesma transação.
  - O `carregarCiclo` foi antecipado do P17, porque o encerramento depende dele. O P17 parte daqui para gravar as tabelas de resultado.
- **Consultas em sequência** dentro das transações: o `pg` não aceita consultas simultâneas na mesma conexão. O aviso `client.query() when the client is already executing` que ainda aparece nos testes vem do próprio Prisma 7 (relações aninhadas numa transação) e já existia no P13.
- **Web**: tela `/ciclos` com o seletor de ciclo na URL, as etapas Rascunho → Ativo → Encerrado e o botão da ação possível, com confirmação e o erro da API no diálogo.
  - Pesos por gestor em tabela, que vira cartões no celular. A situação tem texto e ícone ("Fecha"/"Não fecha").
  - Problemas em duas listas ("Impedem a ativação" e "Avisos"), cada um com o link para onde se resolve.
  - Conferido em 1440 e 360 px com os dados reais do banco de dev.
- **Testes da web** com limite de 15 s: telas com digitação simulada levam 1–2 s sozinhas, mas passavam dos 5 s padrão com 12 arquivos em paralelo no Windows.

**Consequências.** O P17 grava `resultado_*` e `nota_gestor` partindo do `carregarCiclo`. A reabertura (P23) já entra na regra do encerramento. O ciclo de teste `ANO_FECHADO` (2003) foi criado para os testes de encerramento; a limpeza dos testes da API também apaga `nota_fechamento` e `reabertura`.

## ADR-022 — Empacotamento e instalação em produção

- **Data:** 13/11/2026
- **Status:** Aceita
- **Passo:** P16

**Contexto.** O P16 pede o roteiro de instalação no Windows Server (IIS + URL Rewrite + ARR, NSSM, PostgreSQL), o script de deploy e a instalação em produção. Respostas do desenvolvedor (12/11/2026):

- o PostgreSQL 17 fica no mesmo servidor do IIS;
- o certificado HTTPS ainda não está definido;
- o pacote é gerado na máquina de desenvolvimento e copiado para o servidor;
- o servidor tem saída para a internet.

**Decisões técnicas.**

- **Pacote único** (`deploy/empacotar.ps1`, cerca de 115 MB). Contém:
  - a API montada com `pnpm deploy --prod --legacy` e `node-linker=hoisted`, um `node_modules` plano sem nenhum link: os 753 links do pnpm não sobrevivem a um `.zip` no Windows;
  - a web estática com o `web.config`;
  - as migrações;
  - os scripts do servidor;
  - um `versao.json`.

  O servidor não precisa de pnpm nem de acesso ao npm. A compactação usa o `tar.exe` do Windows, porque o `Compress-Archive` é lento e frágil com 20 mil arquivos. O maior caminho do pacote tem 187 caracteres; com `D:\metas\versoes\<versão>\` cabe nos 260 do Windows.

- **Prisma CLI em produção**: `prisma` passou de dependência de desenvolvimento para dependência do `@metas/prisma`, porque as migrações rodam no servidor. A versão continua fixada pelo catálogo e pelo lockfile. `banco/migrar.mjs` chama o CLI do pacote da API com um `prisma.config.mjs` sem `.env` e só aceita `deploy` e `status`.
- **Build da web**: as `VITE_*` de produção vêm de `deploy/producao-web.env`, fora do git. `VITE_API_URL=/api/v1` vai explícito: no Windows, definir uma variável como texto vazio a apaga, e o Vite usaria o valor do `.env` de desenvolvimento, que o teste pegou. O empacotamento recusa o build se o JavaScript contiver `localhost:3000`, `localhost:5173` ou `X-Usuario-Dev`.
- **Configuração da API** em `D:\metas\config\api.env`, lida com `node --env-file`. Em produção a API não procura nenhum `.env` (`main.ts`).
  - A pasta `config` é só de Administradores e SYSTEM. A conta do serviço ganha leitura apenas do `api.env`, nunca do `migracao.env` nem do `pgpass.conf`, que guardam a senha do dono do banco.
- **Serviço `metas-api`** (NSSM):
  - conta LOCAL SERVICE;
  - início automático atrasado e reinício em 5 s;
  - logs com rotação a cada 10 MB;
  - `TZ=America/Sao_Paulo`.

  A API escuta só em `127.0.0.1:3000`.

- **IIS** (`web.config`):
  - HTTP só redireciona para HTTPS;
  - `/api/*` vai para o Node pelo ARR, com o proxy ligado no servidor e 2 minutos de limite;
  - qualquer caminho que não seja arquivo cai no `index.html`;
  - cabeçalhos de segurança no site: CSP com `connect-src` e `frame-src` do `login.microsoftonline.com` e `style-src 'unsafe-inline'` por causa do MUI, HSTS, `nosniff`, `SAMEORIGIN`, `no-referrer`. O IIS não os repete nas respostas da API, que tem os próprios (helmet);
  - cache longo em `/assets` e nenhum no `index.html`.
- **Publicação** (`publicar.ps1`):
  1. extrai em `versoes\<versão>`;
  2. faz backup;
  3. para o serviço e aplica `prisma migrate deploy`;
  4. aponta o serviço (parâmetros do NSSM) e o site (`physicalPath`) para a pasta nova;
  5. confere `/api/v1/saude` por até 60 s e volta sozinho para a versão anterior se a API não responder;
  6. guarda as 5 versões mais recentes.

  `voltar-versao.ps1` aponta de novo para uma versão já extraída; o banco não volta, porque as migrações só acrescentam.

- **Banco**: `criar-banco.sql` cria `metas_owner` (dono do esquema), `metas_app` (só dados, privilégios padrão para o que as migrações criarem) e o banco com o esquema `public` fechado.
- **Primeiro Administrador**: `criar-admin.sql` pré-cadastra pelo e-mail (idempotente) e registra `CRIAR_ADMIN_INSTALACAO` na auditoria. O seed recusa produção, e quem entra sozinho vira Leitor inativo; no primeiro login, a API liga o `oid` ao cadastro (P09).
- **Backup**: `backup.ps1` roda `pg_dump` em formato custom, com a senha no `pgpass.conf`.
  - Confere o arquivo com `pg_restore --list` e apaga os backups com mais de 30 dias.
  - `-Agendar` cria a tarefa diária das 02:00 (SYSTEM).
  - `testar-restauracao.ps1` restaura o último backup num banco temporário, compara as contagens das tabelas principais e apaga o temporário.
- **Scripts `.ps1`** em UTF-8 com BOM e CRLF (`.editorconfig`): o Windows PowerShell 5.1 lê sem BOM como ANSI e corrompia os acentos, o que o teste pegou.

**Como foi testado (13/11/2026), sem IIS nesta máquina.**

- Pacote gerado pelo `empacotar.ps1` e extraído com o `tar` do Windows.
- `criar-banco.sql`, `migrar.mjs deploy` e `criar-admin.sql` (duas vezes) num PostgreSQL 17.11 novo e descartável.
- O `metas_app` não cria tabela, não desliga trigger e não apaga a auditoria.
- A API do pacote subiu com `node --env-file`: saúde ok, `/me` sem token 401, documentação 404, e `AUTH_DEV=true` recusado.
- `backup.ps1` gerou e conferiu o backup e apagou um backup de 31 dias; `testar-restauracao.ps1` restaurou e comparou.
- A web do pacote foi servida com os cabeçalhos lidos do `web.config` e o proxy de `/api`. No Edge, nenhuma violação de CSP nem erro, e o MSAL redirecionou para o login da Microsoft.
- Os seis `.ps1` passam no analisador do PowerShell 5.1.
- Não testados aqui, por dependerem do servidor: `instalar-servico.ps1` (IIS, ARR, NSSM, permissões) e o fluxo do `publicar.ps1` com o NSSM e o IIS.

**Consequências.**

- O serviço `metas-jobs` fica para o P22, quando houver o que rodar; hoje o `apps/jobs` não tem processo.
- A instalação real depende do certificado HTTPS, do registro do aplicativo no Entra ID (o mesmo que falta para fechar o P10) e da execução do roteiro no servidor.
- Os backups ficam no próprio servidor; o roteiro pede à TI uma cópia em outro local.

## ADR-023 — Serviço de resultados e recálculo por evento

- **Data:** 13/11/2026
- **Status:** Aceita
- **Passo:** P17

**Contexto.** O P17 pede o `ResultadosService`, que grava as tabelas de resultado na mesma transação da mudança, o recálculo por evento (especificação 6.5) e as rotas `GET /resultados/gestor/{id}` e `GET /resultados/meta/{id}`. A tabela 7.5 diz que o Leitor vê "os setores liberados a ele", sem dizer o que isso significa para as notas de um gestor.

**Decisão do desenvolvedor (13/11/2026).** No resultado de um gestor, o Leitor vê só as metas dos setores liberados, com resultado e pontos de cada uma, e **não** vê as notas por bloco nem a final, que somam metas que ele não pode ver.

**Decisões técnicas.**

- **Recálculo dentro da transação de quem muda.** O escopo segue a especificação 6.5:
  - meta criada, alterada ou inativada: recalcula a meta sem pai e as submetas;
  - meta excluída: os resultados saem em cascata e as notas são refeitas;
  - variável alterada: recalcula as metas que a usam, e as mães (`recalcularPorVariaveis`; o lançamento do P18 usa o mesmo gatilho);
  - encerramento do ciclo: recalcula o ciclo inteiro antes da fotografia.

  O motor só calcula as metas afetadas. As notas por gestor e bloco são refeitas por uma soma no banco (`INSERT … SELECT … GROUP BY`), que é barata: são cerca de 14 linhas por ciclo.

- **Lock por ciclo** (`pg_advisory_xact_lock`) no recálculo, para dois recálculos do mesmo ciclo não se cruzarem; ele sai sozinho no fim da transação.
- **Ciclo encerrado não recalcula**: as notas ficam congeladas (RN-32). `POST /ciclos/{id}/recalcular` responde `CICLO_ENCERRADO`.
- **Meta inativa não tem resultado nem entra na nota**, coerente com a consistência (P15), que só soma os pesos das metas ativas. Ao reativar, o resultado volta.
- **Gravação em lote**: as linhas mensais e as memórias de cálculo vão para o banco numa única instrução por tabela, com os dados num parâmetro `jsonb` (`jsonb_to_recordset`), sem concatenar SQL. O `createMany` do Prisma levava cerca de 420 ms das 1.800 linhas mensais de um ciclo de 150 metas, e o recálculo inteiro dava ~680 ms. Com o lote, o mesmo recálculo leva ~170 ms (o motor gasta ~70 ms).
- **Números com 6 casas** (`numeric(18,6)`), sem arredondar para exibição: o arredondamento de 2 casas (5.4) fica com quem mostra.
- **`POST /ciclos/{id}/recalcular`** (só Administrador): fora do plano, mas necessário. Os testes gravam lançamentos direto no banco, porque a API de lançamentos é o P18. Também serve depois de uma correção no banco, de uma publicação que mude o cálculo ou de uma carga histórica.
- **`GET /resultados/meta/{id}`** pedido pelo id de uma submeta devolve a mãe, com as submetas. Meta que o usuário não pode ver responde 404, como se não existisse.
- **Pontos numa meta corporativa**: o Gestor vê só a própria atribuição; Administrador, Diretoria e Leitor veem todas. É a opção mais restritiva, porque a 7.5 não diz se um gestor vê os pontos do colega.
- **Permissões no `PoliticasService`**:
  - `acessoResultadosDoGestor` devolve `COMPLETO`, `SETORES` ou `null`;
  - `vePontosDeTodos` diz se o usuário vê os pontos de todos os gestores numa meta corporativa.

**Consequências.**

- O P18 chama `recalcularPorVariaveis` ao gravar os lançamentos.
- O P20 lê `GET /resultados/*`.
- Metas salvas antes do P17 não têm resultado até serem salvas de novo ou até `POST /ciclos/{id}/recalcular`.

## ADR-024 — API de lançamentos

- **Data:** 13/11/2026
- **Status:** Aceita
- **Passo:** P18

**Contexto.** O P18 pede `GET /lancamentos?ciclo&mes` e `PUT /lancamentos` em lote, com permissão (`podeLancar`), trava do mês (motor + reaberturas), tipo e faixa do valor, histórico, conflito de versão e recálculo. A especificação não define a "faixa do valor".

**Decisão do desenvolvedor (13/11/2026).**

- Em todos os tipos, o lançamento aceita qualquer número, positivo ou negativo; o percentual pode passar de 100%. Os casos de teste já usam percentual negativo (CT-09) e dias negativos (CT-10).
- SIM/NÃO só aceita 0 ou 1.
- O valor não pode ter mais casas decimais do que as cadastradas na variável. No percentual, as casas contam no valor digitado de 0 a 100: com 2 casas, 12,34% vale e 12,345% é recusado.

**Decisões técnicas.**

- **Quem lança**:
  - **Gestor**: só no ciclo **ativo** (decisão do P15: os lançamentos começam depois da ativação), nas variáveis pelas quais responde (RN-07, `responsavelPeloLancamento` + `PoliticasService.podeLancar`) e nos meses abertos ou reabertos para ele.
  - **Administrador**: carga histórica (RN-38), em qualquer mês e em ciclo rascunho ou ativo, ignorando a trava; nunca em ciclo encerrado (RN-39). A origem é `CARGA_HISTORICA`; a do Gestor, `DIGITACAO`.
  - Diretoria e Leitor não lançam (403).
- **Status por variável**: a reabertura pode valer para todos, para um setor ou para um gestor (RN-36), então o mesmo mês pode estar fechado para uma variável e reaberto para outra. O GET devolve o status do mês para o usuário e o de cada variável.
- **GET** devolve:
  - as variáveis do usuário (para o Administrador, todas as do ciclo);
  - as de outros setores usadas nas mesmas fórmulas, como somente leitura (`editavel: false`);
  - o valor e a versão do mês, e os valores do ano (para a prévia do acumulado no P19);
  - a definição das metas ativas que usam essas variáveis, com as submetas, para o motor no navegador;
  - o prazo do mês (`fechaEm`).
- **PUT, tudo ou nada**:
  1. Valida o lote inteiro antes de gravar. Os problemas vêm em `detalhes.itens`, e o código do erro é o do mais grave: `SEM_PERMISSAO_VARIAVEL` (403), depois `MES_FUTURO`, `MES_FECHADO` (422, com a data do fechamento) e `VALIDACAO` (400).
  2. Na transação, confere a versão de cada item. No `CONFLITO_VERSAO` (409), `detalhes.conflitos` traz o valor e a versão atuais, para a tela mostrar. A gravação usa `updateMany where versao`, e um `create` simultâneo (violação de unicidade) também vira `CONFLITO_VERSAO`.
  3. Grava o valor e o histórico (`lancamento_historico`, somente inclusão), ligado à reabertura vigente quando o mês estava reaberto para a variável.
  4. Item igual ao gravado não gera histórico nem nova versão. Vazio (`null`) grava `null` e fica no histórico (RN-08, RN-40).
  5. Recalcula as metas que usam as variáveis que mudaram (`recalcularPorVariaveis`, P17).
- **No máximo 500 itens por lote**; o mesmo par variável e mês não pode se repetir no lote.
- **A auditoria dos lançamentos é o `lancamento_historico`** (valor anterior e novo, origem, usuário, data, reabertura), não a tabela `auditoria`.
- **Relógio injetável** (`Relogio`, em `comum/`): os testes fixam a data para simular mês aberto, fechado, reaberto e futuro. O `criarApp` dos testes aceita provedores trocados.
- **Testes**:
  - a limpeza dos dados de teste apaga também o histórico de lançamentos, desligando o trigger de somente inclusão só dentro da transação de limpeza, como já fazia com a auditoria;
  - na web, as esperas da Testing Library (`findBy*`) passaram de 1 s para 5 s: a primeira montagem do sistema inteiro passava de 1 s com os 12 arquivos em paralelo, e testes que não mudaram falhavam de forma alternada.

**Consequências.**

- A tela de lançamento (P19) usa o GET para montar a tela e a prévia, e o PUT para salvar, tratando `CONFLITO_VERSAO` com o valor atual.
- A importação (P24) reaproveita as mesmas regras de permissão, trava e valor.
