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
- **Status:** Aceita; resolução de módulos do `motor` e do `tipos` substituída pelo ADR-005
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
