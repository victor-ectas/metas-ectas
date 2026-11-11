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
- **Status:** Aceita
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
