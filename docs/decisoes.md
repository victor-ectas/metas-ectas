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
