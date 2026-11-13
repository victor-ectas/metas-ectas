# CLAUDE.md — Sistema de Gestão de Metas

Instruções para o Claude Code desenvolver este sistema passo a passo. Leia este arquivo inteiro no início de cada sessão.

> **Para o desenvolvedor humano (leia uma vez)**
>
> 1. Coloque este arquivo na raiz do repositório com o nome `CLAUDE.md`.
> 2. Exporte a especificação técnica ("Sistema de Gestão de Metas — Especificação Técnica") em Markdown e salve como `docs/especificacao.md`. Ela é a fonte completa das regras; este arquivo resume o essencial.
> 3. Em cada sessão, peça: **"Execute o próximo passo do plano."** O Claude Code encontra o primeiro passo não concluído na seção 10, faz, verifica e atualiza o registro de progresso.
> 4. Para retomar algo específico: "Execute o passo P13" ou "Revise o passo P05".
> 5. Revise cada passo concluído antes de pedir o próximo. Um passo por vez.

---

## 1. Contexto do projeto

Aplicação web que substitui planilhas Excel de metas de gestores. O Administrador cadastra metas, variáveis e fórmulas; cada gestor lança as variáveis mês a mês; o sistema calcula o resultado mensal, o acumulado do período, o atendimento, a pontuação e a nota final de cada gestor. Meses fecham automaticamente no 15º dia útil do mês seguinte.

- Usuários: 7 gestores, 17 setores + setor Corporativo. Perfis: Administrador, Diretoria, Gestor, Leitor.
- Acesso só pela rede interna da empresa, em celular, tablet e desktop.
- Login com conta Microsoft da empresa (Entra ID).
- Servidor Windows interno (IIS + serviços Node + PostgreSQL).
- Um único desenvolvedor (humano) com o Claude Code.
- Prazos: **Entrega 1a até 22/01/2027** (gestores lançando janeiro); **Entrega 1b até 12/02/2027** (importação, carga histórica, reabertura etc.). Primeiro fechamento real: 19/02/2027.

Fonte completa das regras: `docs/especificacao.md`. Em caso de conflito entre este arquivo e a especificação, **pare e pergunte**.

---

## 2. Como você (Claude Code) deve trabalhar

### 2.1 Ciclo de cada passo

1. **Localize o passo.** Abra a seção 10 e pegue o primeiro passo com `[ ]`, ou o passo pedido.
2. **Leia antes de escrever.** Leia o passo inteiro, as seções deste arquivo que ele cita e os arquivos do repositório que serão tocados.
3. **Apresente um plano curto** (5 a 10 linhas): arquivos que vai criar ou alterar, decisões que vai tomar, dúvidas. Se houver dúvida de regra de negócio, **pergunte e espere**. Se não houver, siga.
4. **Implemente em pequenos incrementos**, rodando os testes à medida que avança.
5. **Verifique** com `pnpm verify` (lint + typecheck + testes). Corrija até passar. Nunca desative uma regra de lint, um teste ou uma verificação de tipo para "fazer passar".
6. **Confira os critérios de aceite** do passo, um a um, e diga como verificou cada um.
7. **Atualize** a caixa do passo para `[x]` e adicione uma linha no Registro de progresso (seção 12).
8. **Proponha o commit** com mensagem no padrão Conventional Commits em português (ex.: `feat(motor): parser de fórmulas com erros em pt-BR`). Só faça o commit se o desenvolvedor autorizar.
9. **Pare.** Não comece o próximo passo sem ser pedido.

### 2.2 Regras inegociáveis

- **Não invente regra de negócio.** Se algo não está aqui nem em `docs/especificacao.md`, pergunte.
- **Não pule passos** nem antecipe funcionalidades de passos futuros, a não ser que o passo atual dependa delas (nesse caso, explique).
- **Não use `float` para dinheiro, percentuais ou notas.** Use `decimal.js` no código e `numeric` no banco (seção 5.4).
- **Não use `eval`, `new Function` ou similares**, em lugar nenhum.
- **Nunca grave segredos no repositório.** Tudo em `.env` (ignorado pelo git), com `.env.example` documentado.
- **Peça confirmação antes de qualquer comando destrutivo**: `DROP`, `prisma migrate reset`, `rm -rf`, `git push --force`, `git reset --hard`, apagar arquivos fora do que o passo pede.
- **Migrações aplicadas são imutáveis.** Mudou o esquema? Crie uma migração nova.
- **Não instale dependência sem dizer por quê.** Prefira as da seção 3. Nada de pacote abandonado ou com poucos downloads para algo trivial.
- **Toda regra de permissão é verificada na API**, no serviço de políticas (seção 6). A interface só esconde botões; ela não decide.
- **Se um teste do motor falhar depois de uma mudança, o motor está errado até prova em contrário.** Os casos da seção 8.7 são a referência.

### 2.3 Idioma e nomes

- Interface, mensagens de erro, textos e documentação: **português do Brasil**.
- **Domínio em português, sem acentos**, igual ao modelo de dados: `meta`, `variavel`, `lancamento`, `ciclo`, `setor`, `atribuicao`, `mesInicio`, `regraPontuacao`.
- Infraestrutura pode ficar em inglês (`config`, `logger`, `health`, `utils`).
- Arquivos em `kebab-case`; classes e componentes em `PascalCase`; variáveis e funções em `camelCase`; tabelas e colunas do banco em `snake_case` (mapeadas no Prisma com `@@map` e `@map`).

---

## 3. Stack

Fixe as versões exatas no `package.json` ao instalar (sem `^` nas dependências de runtime) e registre as escolhas na seção 13.

| Camada | Tecnologia |
| --- | --- |
| Runtime | Node.js 26 LTS (registrar a versão exata em `.nvmrc` e em `engines` no `package.json`) |
| Gerenciador | pnpm (workspaces), instalado com `npm install -g pnpm@<versão>` (o Node 26 não traz o corepack); versão fixada em `packageManager` no `package.json` |
| Linguagem | TypeScript, `strict: true`, `noUncheckedIndexedAccess: true` |
| Front-end | React 18 + Vite, MUI (componentes), TanStack Query, React Router, React Hook Form + Zod, ECharts (gráficos) |
| Login no front | `@azure/msal-browser` + `@azure/msal-react` (Authorization Code + PKCE) |
| API | NestJS |
| Banco | PostgreSQL, na **mesma versão major do servidor de produção** (16 ou superior) |
| ORM e migrações | Prisma |
| Validação | Zod (schemas compartilhados em `packages/tipos`) |
| Decimal | `decimal.js` |
| Datas e fuso | Luxon, sempre com zona `America/Sao_Paulo` nas regras de fechamento |
| JWT | `jose` (validação de token do Entra ID via JWKS) |
| Jobs | `pg-boss` (fila no próprio PostgreSQL) |
| Excel | `exceljs` |
| Logs | `pino` (JSON) |
| Testes | Vitest (unitários e de integração; na API, com `unplugin-swc` para decorators), Supertest (API), Playwright (ponta a ponta) |
| Qualidade | ESLint (flat config, `typescript-eslint`), Prettier |
| Produção | Windows Server, IIS + URL Rewrite + ARR (proxy reverso e estáticos), serviços Node via NSSM |

---

## 4. Estrutura do repositório

```
metas/
  CLAUDE.md
  README.md
  package.json            # scripts raiz: dev, build, verify, test, lint, typecheck
  pnpm-workspace.yaml
  tsconfig.base.json
  eslint.config.js
  .prettierrc
  .editorconfig
  .gitignore
  .env.example
  docs/
    especificacao.md      # especificação técnica completa (exportada)
    decisoes.md           # decisões técnicas (ADRs curtos)
    deploy-windows.md     # roteiro de instalação no servidor (passo P16)
  packages/
    motor/                # parser de fórmulas + cálculo + calendário. SEM banco, SEM HTTP, SEM Nest.
      src/
        formula/          # tokenizer, parser, ast, avaliador, validador, erros
        calculo/          # acumulacao, resultado-mensal, acumulado, atendimento, pontuacao, submetas, nota, memoria
        calendario/       # dias uteis, data de fechamento, status do mes
        index.ts
      test/
    tipos/                # enums, DTOs e schemas Zod compartilhados entre api e web
  apps/
    api/                  # NestJS
      src/
        config/           # leitura e validação das variáveis de ambiente (Zod)
        comum/            # filtro de erros, interceptors, pipes, decorators
        prisma/           # PrismaService
        auth/             # validação de JWT, usuário atual, modo DEV
        politicas/        # serviço central de autorização
        auditoria/
        cadastros/        # usuarios, setores, ciclos, feriados, responsaveis
        variaveis/
        metas/
        lancamentos/
        resultados/       # orquestra o motor e grava tabelas de resultado
        fechamento/       # calendário, reaberturas
        importacao/
        saude/
      test/
    jobs/                 # worker pg-boss
    web/                  # React + Vite
      src/
        app/              # rotas, layout, provedores
        auth/             # MSAL
        api/              # cliente HTTP + hooks TanStack Query
        componentes/
        paginas/
        formatacao/       # números, moeda, percentuais, datas pt-BR
      e2e/                # Playwright
  prisma/
    schema.prisma
    migrations/
    seed.ts
```

`packages/motor` é o coração do sistema. Ele é usado pela API (cálculo oficial) e pela web (prévia enquanto o gestor digita). Por isso não pode depender de nada de servidor.

---

## 5. Convenções de código

### 5.1 TypeScript

- `strict`, sem `any` (use `unknown` e estreite). Sem `// @ts-ignore`; se for inevitável, `// @ts-expect-error` com o motivo.
- Funções puras sempre que possível, sobretudo no motor.
- Erros de domínio como classes com `codigo` (ver 5.3), nunca `throw "texto"`.

### 5.2 API

- Prefixo `/api/v1`. JSON. OpenAPI gerado pelo Nest em `/api/v1/docs` (só fora de produção, ou protegido).
- Toda entrada validada com Zod (schemas de `packages/tipos`).
- Paginação em listas grandes: `?pagina=1&tamanho=50`.
- Escrita em lote numa transação. Lançamentos usam controle otimista com o campo `versao`.

### 5.3 Formato de erro

Toda resposta de erro segue:

```json
{ "codigo": "MES_FECHADO", "mensagem": "Outubro/2026 fechou em 24/11/2026.", "detalhes": {} }
```

Códigos iniciais: `NAO_AUTENTICADO`, `SEM_PERMISSAO`, `SEM_PERMISSAO_VARIAVEL`, `NAO_ENCONTRADO`, `VALIDACAO`, `MES_FECHADO`, `MES_FUTURO`, `CONFLITO_VERSAO`, `FORMULA_INVALIDA`, `PESOS_INCONSISTENTES`, `CICLO_ENCERRADO`, `IMPORTACAO_INVALIDA`, `ERRO_INTERNO`. Mensagens em português, sem detalhes internos (stack, SQL) para o usuário.

### 5.4 Números, percentuais e datas

- Banco: `numeric(18,6)` para valores, objetivos, pesos, resultados. Nunca `real` ou `double precision`.
- Código: `Decimal` (`decimal.js`) do banco até a resposta. Converter para `string` no JSON; a web converte para exibir.
- Percentual é **guardado como fração** (25% → `0.25`) e **digitado de 0 a 100** na tela.
- SIM/NÃO é guardado como `1`/`0`.
- **Vazio é `null`, nunca `0`.** Apagar um valor grava `null`.
- Arredondamento de exibição e de resultado final: 2 casas na unidade exibida, meio para cima (`Decimal.ROUND_HALF_UP`). Percentual: 2 casas em pontos percentuais (`0.79912` → `79,91%`). Nada é arredondado no meio do cálculo, a não ser que a fórmula use `ARRED`.
- Datas: `timestamptz` no banco; regras de fechamento sempre em `America/Sao_Paulo`. Exibição `dd/mm/aaaa`.

### 5.5 Testes

- `packages/motor`: **100% de cobertura de linhas e ramos**, e todos os casos da seção 8.7.
- API: testes de integração para permissão, trava de mês, lançamento em lote, conflito de versão e importação (banco de teste real, não mock do Prisma).
- Web: testes de componentes críticos (tela de lançamento) e um fluxo E2E com Playwright.
- Teste novo para todo bug corrigido.

### 5.6 Scripts raiz obrigatórios

```
pnpm dev        # sobe api, jobs e web em modo desenvolvimento
pnpm build      # build de todos os pacotes
pnpm lint
pnpm typecheck
pnpm test
pnpm verify     # lint + typecheck + test — tem que passar ao fim de todo passo
```

---

## 6. Segurança

- **Autenticação**: a API valida o JWT do Entra ID com `jose` e `createRemoteJWKSet`. Verifique assinatura, emissor do tenant, audiência (o escopo da API) e expiração. Configure o app para tokens v2 (`accessTokenAcceptedVersion: 2` no manifesto); o emissor esperado é `https://login.microsoftonline.com/{TENANT_ID}/v2.0`.
- **Usuário**: o `oid` do token identifica o usuário. No primeiro acesso, criar como `LEITOR` inativo; só o Administrador ativa e define o perfil. Perfis ficam no banco do sistema, não em grupos do Entra ID.
- **Modo DEV de autenticação**: permitido só com `NODE_ENV=development` e `AUTH_DEV=true`, simulando um usuário escolhido. A API **deve se recusar a iniciar** se `AUTH_DEV=true` com `NODE_ENV=production`.
- **Autorização**: um único `PoliticasService` responde perguntas como `podeLancar(usuario, variavel, mes)`, `podeVerMeta(usuario, meta)`, `podeEditarMetas(usuario)`. Controllers chamam o serviço; nada de checagem espalhada. Cada regra tem teste.
- **Cabeçalhos**: `helmet` (CSP, HSTS, etc.), CORS fechado para a origem do front.
- **Limite de taxa** nas rotas de escrita e de importação.
- **Uploads** (Fase 2): checar tipo real pelo conteúdo, limite de 10 MB, nome aleatório no disco, pasta fora do site, servidos só pela API após checar permissão.
- **SQL**: só via Prisma ou `$queryRaw` com template parametrizado. Nunca concatenar SQL.
- **Logs**: nunca logar token, e-mail completo em massa ou conteúdo de avaliação de comportamento.
- **Auditoria**: alterações em metas, pesos, fórmulas, permissões, ciclos, reaberturas e lançamentos ficam registradas (somente inclusão).
- **Dependências**: rodar `pnpm audit` ao fim de cada etapa e registrar o resultado.

---

## 7. Regras de negócio essenciais

Resumo das regras que o código implementa. Numeração igual à da especificação (RN-xx).

### 7.1 Estrutura e pesos

- **RN-01** Ciclo = ano, janeiro a dezembro. Tudo pertence a um ciclo.
- **RN-02** Bloco da meta derivado do setor: setor Corporativo → bloco `CORPORATIVO`; outros → `DEPARTAMENTAL`.
- **RN-03** Por gestor e ciclo: Corporativo soma 50 pontos e Departamental soma 50 (total 100). Sem metas corporativas, Departamental soma 100. Os pesos departamentais somam o total do bloco **juntos**, não por setor.
- **RN-04** Só metas sem pai têm peso no bloco. Submetas têm `pesoInterno`, e as irmãs somam 100,00%.
- **RN-05** Meta corporativa: um conjunto de lançamentos e um resultado; atribuída a N gestores, cada um com peso próprio (tabela `meta_atribuicao`). Quem lança é o gestor responsável pela meta.
- **RN-06** Toda meta tem exatamente um responsável. Sem substituto nem delegação.

### 7.2 Variáveis e lançamentos

- **RN-07** Toda variável pertence a um setor e é lançada pelo responsável do setor no ciclo. Variáveis do Corporativo têm `responsavelId` próprio.
- **RN-08** Vazio ≠ zero. Vazio é ignorado em todas as acumulações; zero conta.
- **RN-09** Acumulação por variável: `SOMA`, `MEDIA` (dos meses com valor), `ULTIMO` (último mês com valor no período), `MAXIMO`.
- **RN-10** SIM/NÃO = 1/0.
- **RN-11** Percentual digitado de 0 a 100, guardado como fração.
- **RN-12** Variável compartilhada: um lançamento por mês, usado por todas as metas que a referenciam.

### 7.3 Período e objetivo

- **RN-13** Meta tem `mesInicio` e `mesFim`. Só esses meses contam para acumulado, atendimento e nota.
- **RN-14** Lançamentos fora do período são aceitos e exibidos como histórico; não alteram a nota.
- **RN-15** Objetivo único (`mes = 0`) ou mensal (`mes` 1–12). Resultado mensal compara com o objetivo do mês. **Acumulado compara com o objetivo do último mês do período** (se não houver objetivo mensal, usa o único).

### 7.4 Fechamento

- **RN-33** Dia útil = segunda a sexta, exceto feriados cadastrados (calendário de Joinville/SC, mantido pelo Administrador).
- **RN-34** O mês M aceita lançamentos de 1º de M até 23h59 (America/Sao_Paulo) do **15º dia útil de M+1**, contando a partir do 1º dia útil de M+1, inclusive. Meses depois do mês corrente não aceitam lançamento.
- **RN-35** A trava é verificada no servidor em toda gravação. O job só atualiza status e dispara avisos.
- **RN-36** Reabertura: só Administrador; escopo (mês + todos, setor ou gestor), data-limite, motivo e autorizador (texto). Vencida a data-limite, volta a fechar.
- **RN-38** Carga histórica: só Administrador, qualquer mês e ciclo, ignorando a trava; origem `CARGA_HISTORICA`.
- **RN-39** Alterar meta em ciclo ativo: permitido ao Administrador, auditado, dispara recálculo. Ciclo `ENCERRADO` não aceita alterações.
- **RN-40** Histórico somente inclusão.
- **RN-41** Importação Excel transacional: valida, mostra prévia, grava tudo ou nada.

### 7.5 Permissões

| Ação | ADMIN | DIRETORIA | GESTOR | LEITOR |
| --- | --- | --- | --- | --- |
| Cadastros (ciclos, setores, usuários, feriados, metas, variáveis, modelos) | sim | não | não | não |
| Ver metas e resultados | todos | todos | só as próprias e as atribuídas a ele | setores liberados |
| Lançar em mês aberto | só em carga histórica | não | variáveis dos seus setores e das metas corporativas pelas quais responde | não |
| Reabrir mês | sim | não | não | não |
| Importar Excel | sim, como carga histórica, em qualquer mês | não | sim, só nas suas variáveis e em meses abertos (RN-41) | não |
| Carga histórica (lançar ignorando a trava) | sim | não | não | não |
| Ver histórico de alterações | todos | todos | só das próprias metas | não |
| Aprovar correção (Fase 2) | não | só o Gerente Geral | não | não |

---

## 8. Motor de cálculo (`packages/motor`)

### 8.1 Linguagem de fórmulas

| Elemento | Sintaxe |
| --- | --- |
| Variável | Código em maiúsculas: letras, números, `_`. Ex.: `PRESENCAS` |
| Variável de outro setor | `SETOR.VAR`. Ex.: `RH.TOTAL_COLAB` |
| Número | `0,5` ou `0.5` |
| Aritmética | `+ - * /`, parênteses, menos unário |
| Comparação | `= <> < > <= >=` → 1 ou 0 |
| Funções | `SE(cond; a; b)`, `E(...)`, `OU(...)`, `NAO(a)`, `ARRED(x; casas)`, `MIN(...)`, `MAX(...)`, `ABS(x)` |
| Fase 2 | `ANTERIOR(VAR)`, `META("CODIGO")` (não implementar na Fase 1, mas deixar o parser preparado para chamadas de função genéricas) |

- Separador de argumentos: `;`. A vírgula também separa argumentos quando não pode ser decimal: em `ARRED(X,2)` ela separa, porque `X` não é número; em `ARRED(3,2)` ela é decimal, e o resultado é um único argumento `3,2` (erro de aridade). A mensagem desse erro deve sugerir usar `;`. Cubra os dois casos nos testes.
- Funções e variáveis não diferenciam maiúsculas de minúsculas na digitação, mas são normalizadas para maiúsculas.
- Precedência: unário > `* /` > `+ -` > comparação.
- Implementação: tokenizer + parser descendente recursivo → AST (JSON serializável) → avaliador com `Decimal`.
- Erros com mensagem em português e posição: `Esperava ")" na posição 18, perto de "EVENTOS"`, `Variável desconhecida: TOTAL`, `Função desconhecida: SOMASE`, `ARRED espera 2 argumentos`.
- Divisão por zero não lança erro de sistema: o resultado é `null` com aviso `DIVISAO_POR_ZERO`.
- Variável usada sem valor no mês → resultado `null` (RN-16).
- Exportar: `parse(texto)`, `validar(texto, variaveisDisponiveis)`, `variaveisUsadas(ast)`, `avaliar(ast, escopo)`.

### 8.2 Acumulação de variável (RN-09)

Sobre os meses do período, ignorando `null`: `SOMA`, `MEDIA`, `ULTIMO`, `MAXIMO`. Sem nenhum valor → `null`.

### 8.3 Resultado mensal e acumulado (RN-16, RN-17)

- Resultado do mês `m` = `avaliar(formula, {var: valor do mês m})`; qualquer variável usada vazia → `null`.
- Meses fora do período também são calculados, marcados `foraPeriodo: true`.
- Modo de apuração da meta (`modoApuracao`):
  - `FORMULA_SOBRE_ACUMULADOS` (padrão para razões): acumula cada variável pela sua regra nos meses do período e avalia a fórmula uma vez.
  - `SOMA_RESULTADOS`, `MEDIA_RESULTADOS`, `MAXIMO_RESULTADOS`, `ULTIMO_RESULTADO`: agregam os resultados mensais não nulos do período.
- Nenhum dado no período → acumulado `null`, situação `SEM_DADOS`.

### 8.4 Atendimento (RN-21) — sempre entre 0 e 1

R = acumulado, O = objetivo do último mês do período, T = tolerância.

| Operador | Regra |
| --- | --- |
| `GE` (≥) | R ≥ O → 1; senão R/O se R > 0 e O > 0; senão 0 |
| `LE` (≤) | R ≤ O → 1; senão O/R se R > 0 e O > 0; senão 0 |
| `EQ` (=) | \|R − O\| ≤ 0,005 → 1; senão min(R,O)/max(R,O) se ambos > 0; senão 0 |
| `FAIXA` (±) | O − T ≤ R ≤ O + T → 1; senão 0 |

### 8.5 Pontuação e situação (RN-22 a RN-25)

- `TUDO_OU_NADA`: pontos = peso se atendimento = 1, senão 0.
- `PROPORCIONAL`: pontos = peso × atendimento.
- `FAIXA` é sempre tudo ou nada.
- Teto: atendimento nunca passa de 1; pontos nunca passam do peso.
- O cadastro **não permite** `PROPORCIONAL` com objetivo ≤ 0 (RN-23). O motor expõe `validarMeta()` que retorna esse erro.
- Situação: `BATIDA` (atendimento = 1), `ABAIXO`, `FORA_DA_FAIXA` (operador FAIXA não atendido), `SEM_DADOS`.

### 8.6 Submetas e nota (RN-26 a RN-31)

- Máximo 2 níveis.
- Atendimento da mãe = Σ (pesoInterno_i × min(atendimento_i, 1)). Se a mãe tem fórmula própria, ela entra como componente adicional com `pesoInterno` (RN-30). Os pesos internos somam 100,00%.
- Submeta só contribui com atendimento; não tem pontos próprios no bloco.
- Pontos da mãe = regra da mãe sobre o atendimento composto × peso da atribuição.
- Nota do bloco = Σ pontos das metas do bloco do gestor. Nota final = Corporativo + Departamental.
- O motor devolve também a **memória de cálculo** de cada meta: valores acumulados por variável, fórmula, resultado, objetivo usado, operador, atendimento, regra, pontos, avisos.

### 8.7 Casos de teste obrigatórios

Todos com dados reais das planilhas de 2026. Use exatamente estes números.

| ID | Configuração | Entradas | Esperado |
| --- | --- | --- | --- |
| CT-01 | `REQ_ATENDIDOS / TOTAL_REQ`; ambas SOMA; FORMULA_SOBRE_ACUMULADOS; GE 0,80 | jan 16/20; fev 20/25 | 0,80 → 80,00%; atendimento 1; BATIDA |
| CT-02 | `CHECKLISTS / PROC_CRITICOS`; ambas ULTIMO; GE 0,90 | jan–out CHECKLISTS 0,0,0,5,5,5,10,10,10,10; PROC_CRITICOS 10 todo mês | 1,00 → 100,00%; BATIDA |
| CT-03 | `MEDIA_DIAS`; MEDIA_RESULTADOS; LE 2; peso 10 | jan–ago 5,2; 0,43; 3; 1,17; 1,14; 2; 1,67; 6,5 | 2,63875 → 2,64 dias; atendimento 0,757935 → 75,79%; TUDO_OU_NADA 0,00 pts; PROPORCIONAL 7,58 pts |
| CT-04 | `(REALIZADO - ORCADO) / ORCADO`; ambas SOMA; FAIXA 0 ± 0,05 | jan–nov REALIZADO 14695,68; 11004,8; 11866,35; 11197,99; 11148,44; 9859,63; 8223,26; 8210,82; 8350,4; 7458,19; 1064,71 · ORCADO 16477,22; 12164,83; 12160,04; 11768,95; 12648,31; 11547,72; 19230,17; 17449,68; 17796,95; 17196,91; 4506,21 | totais 103.080,27 / 152.946,99 → −32,60%; FORA_DA_FAIXA; 0 pts |
| CT-05 | `IMPLANTADO` (SIM/NÃO); período jan–mai; MAXIMO_RESULTADOS; EQ 1 | jan–abr NÃO; mai SIM | 1; BATIDA |
| CT-06 | Igual ao CT-05 | jan–mai NÃO; jun SIM | acumulado 0; ABAIXO; junho com `foraPeriodo: true` |
| CT-07 | `RETRABALHO / NFS`; ambas SOMA; LE 0,05; PROPORCIONAL; peso 10 | jan–set RETRABALHO 11,19,18,0,9,11,11,8,12; NFS 72,73,75,60,81,77,101,81,87 | 99/707 → 14,00%; atendimento 0,357071 → 35,71%; 3,57 pts |
| CT-08 | `PCT_IMPL` (percentual); ULTIMO_RESULTADO; EQ 1; peso 15 | ... nov 0,90 | 90,00%; atendimento 0,90; TUDO_OU_NADA 0 pts; PROPORCIONAL 13,50 pts |
| CT-09 | `PCT_REDUCAO`; ULTIMO_RESULTADO; LE −0,10 | set −0,197886 | BATIDA; `validarMeta` com PROPORCIONAL retorna erro (objetivo ≤ 0) |
| CT-10 | `MEDIA_DIAS`; MEDIA_RESULTADOS; LE 3 | jan–out −6; −12,8; −11,7; −9,5; −2,5; −6,5; 0,5; −3; −10,3; −2,3 | −6,41 dias; BATIDA |
| CT-11 | `RELATORIOS / VISITAS`; ambas SOMA; GE 0,95; peso 10 | jan 15/15; fev 10/10 | 100%; atendimento 1 (teto); 10,00 pts (não 10,53) |
| CT-12 | Mãe com 5 submetas × 20%; PROPORCIONAL; peso 10 | atendimentos das filhas: 0,99537; 1; 1; 0; 1 | atendimento da mãe 0,799074 → 79,91%; 7,99 pts |
| CT-13 | MEDIA de variável | jan 2; fev vazio; mar 4 | 3 (não 2) |
| CT-14 | `CHECKLISTS / PROC_CRITICOS` | um mês com PROC_CRITICOS = 0 | resultado do mês `null` + aviso DIVISAO_POR_ZERO; acumulado ignora o mês |
| CT-15 | Meta corporativa atribuída a 2 gestores (pesos 15 e 10) | um lançamento; atendimento A | mesmo atendimento; pontos 15×A e 10×A |
| CT-16 | Período jul–dez; objetivo mensal jul 0,50 … dez 1,00; GE | lançamentos jan–jun existem; acumulado jul–dez 0,80 | jan–jun `foraPeriodo`; compara com 1,00; atendimento 0,80 |
| CT-17 | Gestor sem corporativas, departamentais somando 90 | — | erro `PESOS_INCONSISTENTES` na validação de consistência |
| CT-18 | Calendário: outubro/2026, feriados 02/11 e 20/11 | — | fechamento 24/11/2026 23:59:59 (America/Sao_Paulo); status `ABERTO` em 24/11 23:59, `FECHADO` em 25/11 00:00; com reabertura até 27/11 → `REABERTO` |

Caso extra de calendário: dezembro/2026 com feriado 01/01/2027 → fechamento 22/01/2027.

---

## 9. Modelo de dados (Prisma / PostgreSQL)

Convenções: chaves `uuid` (`@default(uuid())`), valores `Decimal @db.Decimal(18, 6)`, datas `DateTime @db.Timestamptz`, mês `Int @db.SmallInt` com `CHECK` (via SQL na migração), enums do PostgreSQL. Toda tabela de negócio tem `criadoEm`, `criadoPor`, `atualizadoEm`, `atualizadoPor`.

### 9.1 Enums

`Perfil` (ADMIN, DIRETORIA, GESTOR, LEITOR) · `StatusCiclo` (RASCUNHO, ATIVO, ENCERRADO) · `TipoFeriado` (NACIONAL, ESTADUAL, MUNICIPAL, EMPRESA) · `TipoVariavel` (NUMERO, PERCENTUAL, MOEDA, DIAS, HORAS, SIM_NAO) · `Acumulacao` (SOMA, MEDIA, ULTIMO, MAXIMO) · `OrigemVariavel` (DIGITADA, IMPORTADA) · `ModoApuracao` (FORMULA_SOBRE_ACUMULADOS, SOMA_RESULTADOS, MEDIA_RESULTADOS, MAXIMO_RESULTADOS, ULTIMO_RESULTADO) · `Operador` (GE, LE, EQ, FAIXA) · `RegraPontuacao` (TUDO_OU_NADA, PROPORCIONAL) · `Unidade` (PERCENTUAL, NUMERO, DIAS, HORAS, MOEDA, SIM_NAO) · `OrigemLancamento` (DIGITACAO, IMPORTACAO, CARGA_HISTORICA, CORRECAO) · `EscopoReabertura` (TODOS, SETOR, GESTOR) · `Situacao` (BATIDA, ABAIXO, FORA_DA_FAIXA, SEM_DADOS) · `Bloco` (CORPORATIVO, DEPARTAMENTAL).

### 9.2 Tabelas da Fase 1

| Tabela | Campos principais | Restrições |
| --- | --- | --- |
| `usuario` | id, entra_oid, nome, email, perfil, gerente_geral, superior_id, ativo | `entra_oid` e `email` únicos |
| `setor` | id, codigo, nome, corporativo, ativo | `codigo` único; no máximo um `corporativo = true` (índice único parcial) |
| `ciclo` | id, ano, status, encerrado_em, encerrado_por | `ano` único |
| `setor_responsavel` | ciclo_id, setor_id, usuario_id | PK (ciclo_id, setor_id) |
| `leitor_setor` | usuario_id, setor_id | PK composta |
| `feriado` | id, data, descricao, tipo | `data` única |
| `modelo_meta` | id, codigo, nome, metrica, unidade, formula, modo_apuracao, operador_sugerido, ativo | `codigo` único |
| `modelo_variavel` | id, modelo_id, codigo, nome, tipo, acumulacao | único (modelo_id, codigo) |
| `variavel` | id, ciclo_id, setor_id, codigo, nome, tipo, acumulacao, origem, responsavel_id, casas_decimais, ativo | único (ciclo_id, setor_id, codigo) |
| `meta` | id, ciclo_id, setor_id, meta_pai_id, modelo_id, codigo, indicador, metrica, unidade, formula_texto, formula_ast (jsonb), modo_apuracao, operador, tolerancia, mes_inicio, mes_fim, regra_pontuacao, peso_interno, responsavel_id, ordem, ativo, versao | `CHECK (mes_inicio BETWEEN 1 AND 12 AND mes_fim BETWEEN mes_inicio AND 12)`; trigger impede neto (pai de pai); único (ciclo_id, codigo) |
| `meta_variavel` | meta_id, variavel_id | PK composta; derivada da AST ao salvar |
| `meta_objetivo` | meta_id, mes (0 = único), valor | PK (meta_id, mes); `CHECK (mes BETWEEN 0 AND 12)` |
| `meta_atribuicao` | id, meta_id, usuario_id, peso | único (meta_id, usuario_id); submeta não tem atribuição |
| `lancamento` | id, variavel_id, mes, valor (nulo = vazio), origem, versao, atualizado_por, atualizado_em | único (variavel_id, mes) |
| `lancamento_historico` | id, lancamento_id, valor_anterior, valor_novo, origem, usuario_id, em, importacao_id, reabertura_id | sem UPDATE/DELETE (revogar no usuário da aplicação ou trigger que bloqueia) |
| `reabertura` | id, ciclo_id, mes, escopo, escopo_id, valido_ate, motivo, autorizado_por, criado_por, cancelada_em | |
| `importacao` | id, arquivo_nome, modo, linhas_total, linhas_gravadas, status, erros (jsonb), usuario_id | |
| `resultado_meta_mes` | meta_id, mes, resultado, objetivo, atendimento, situacao, fora_periodo, aviso, calculado_em | PK (meta_id, mes) |
| `resultado_meta` | meta_id, resultado_acumulado, objetivo_usado, atendimento, situacao, memoria (jsonb), calculado_em | PK meta_id |
| `resultado_atribuicao` | atribuicao_id, pontos, calculado_em | PK atribuicao_id |
| `nota_gestor` | ciclo_id, usuario_id, bloco, peso_total, pontos, calculado_em | PK (ciclo_id, usuario_id, bloco) |
| `nota_fechamento` | ciclo_id, usuario_id, bloco, pontos, dados (jsonb), congelado_em | |
| `auditoria` | id, entidade, entidade_id, acao, antes (jsonb), depois (jsonb), usuario_id, em, ip | somente inclusão |

Fase 2 (não criar antes da hora): `correcao`, `evidencia`, `comentario`, `notificacao`, `competencia`, `comportamento`, `funcionario`, `avaliacao`, `avaliacao_nota`, `avaliacao_comentario`.

Schema `bi` (passo P27): views só de leitura `bi.dim_ciclo`, `bi.dim_setor`, `bi.dim_gestor`, `bi.dim_meta`, `bi.fato_resultado_mes`, `bi.fato_meta`, `bi.fato_pontos`, `bi.fato_nota`, acessadas pelo usuário `bi_leitor`.

---

## 10. Plano de desenvolvimento passo a passo

Cada passo tem objetivo, tarefas e critérios de aceite. Marque `[x]` ao concluir. **Um passo por sessão de trabalho, sempre terminando com `pnpm verify` verde.**

### Etapa 1 — Fundação e motor (16/11 a 04/12/2026)

- [x] **P01 — Monorepo e qualidade**
  - Tarefas: `git init`; pnpm workspaces com `apps/api`, `apps/jobs`, `apps/web`, `packages/motor`, `packages/tipos`; `tsconfig.base.json` estrito; ESLint flat + Prettier; Vitest configurado em cada pacote; `.editorconfig`, `.gitignore` (incluindo `.env`, `node_modules`, `dist`, `coverage`), `.env.example`; scripts raiz da seção 5.6; `README.md` com como rodar; `docs/decisoes.md` vazio com modelo de ADR.
  - Aceite: `pnpm install` e `pnpm verify` passam num repositório limpo; um teste trivial em cada pacote roda.

- [x] **P02 — Pacote `tipos`**
  - Tarefas: enums da seção 9.1 como `const` + tipos; schemas Zod base (ex.: `MesSchema` 1–12, `DecimalStringSchema`); códigos de erro da seção 5.3.
  - Aceite: importável por `motor`, `api` e `web`; testes dos schemas.

- [x] **P03 — Motor: parser de fórmulas**
  - Tarefas: tokenizer (números com ponto ou vírgula, identificadores com `SETOR.VAR`, operadores, `;` e `,`); parser descendente recursivo com precedência da 8.1; AST serializável; mensagens de erro em português com posição.
  - Aceite: testes para cada token, precedência, parênteses, unário, funções com 0..N argumentos, `SETOR.VAR`, ambiguidade de vírgula e pelo menos 15 entradas inválidas com a mensagem esperada.

- [x] **P04 — Motor: avaliador e validador**
  - Tarefas: avaliação com `Decimal`; funções `SE`, `E`, `OU`, `NAO`, `ARRED`, `MIN`, `MAX`, `ABS`; comparação devolvendo 1/0; divisão por zero → `null` + aviso; variável sem valor → `null`; `validar(texto, variaveisDisponiveis)` (variáveis desconhecidas, função desconhecida, aridade); `variaveisUsadas(ast)`.
  - Aceite: 100% de cobertura do módulo `formula`; `0.1 + 0.2 = 0.3` exato.

- [x] **P05 — Motor: cálculo de metas**
  - Tarefas: acumulação (8.2), resultado mensal e acumulado (8.3), atendimento (8.4), pontuação e situação (8.5), submetas e nota (8.6), memória de cálculo, `validarMeta()` (proporcional com objetivo ≤ 0, pesos internos ≠ 100%), `validarPesosGestor()` (RN-03). API do pacote orientada a dados: recebe definições + lançamentos, devolve resultados.
  - Aceite: **CT-01 a CT-17 passando** como testes nomeados pelo ID; 100% de cobertura do módulo `calculo`.

- [x] **P06 — Motor: calendário e status do mês**
  - Tarefas: `diasUteis(feriados)`, `dataFechamento(ano, mes, feriados)`, `statusMes(ano, mes, agora, feriados, reaberturas)` → `ABERTO | FECHADO | REABERTO | FUTURO`; tudo em `America/Sao_Paulo` com Luxon.
  - Aceite: CT-18 e o caso de dezembro/2026 passando; testes de virada de ano e de mês com feriado no 1º dia útil.

- [x] **P07 — Banco de dados**
  - Tarefas: PostgreSQL local na mesma versão major da produção (documentar a instalação no Windows pelo instalador oficial; Docker opcional); `prisma/schema.prisma` com as tabelas da Fase 1 (9.2); migração inicial com `CHECK`s, índice único parcial do Corporativo, trigger de 2 níveis e proteção do histórico (SQL na migração); `seed.ts` só para desenvolvimento (um Admin a partir de `SEED_ADMIN_EMAIL`, setores e ciclo de exemplo) e que se recusa a rodar em produção.
  - Aceite: `prisma migrate dev` cria tudo do zero; testes de integração provam os `CHECK`s, o trigger e o bloqueio de UPDATE/DELETE no histórico.

- [x] **P08 — API base**
  - Tarefas: NestJS em `apps/api`; config com Zod (falha ao iniciar se faltar variável); `pino` com `requestId`; filtro global de erros no formato 5.3; `PrismaService`; `GET /api/v1/saude` (banco ok); OpenAPI; `helmet`, CORS restrito, limite de taxa.
  - Aceite: testes de integração do filtro de erro e da rota de saúde; API sobe com `pnpm dev`.

- [x] **P09 — Autenticação e políticas**
  - Tarefas: guard que valida JWT do Entra ID (seção 6); modo DEV (com trava de produção); provisionamento no 1º acesso como LEITOR inativo; `GET /me`; `PoliticasService` com as regras da 7.5 (implementar agora as de cadastro e visualização; as de lançamento ficam prontas para o P18); decorator `@Perfis(...)`.
  - Aceite: testes cobrindo token inválido, expirado, de outro tenant, usuário inativo, cada perfil; a API não inicia com `AUTH_DEV=true` em produção.

- [ ] **P10 — Web base**
  - Tarefas: Vite + React + MUI; layout responsivo (menu lateral no desktop, menu inferior ou gaveta no celular); rotas; MSAL configurado por variáveis de ambiente; cliente HTTP que injeta o token e trata o formato de erro; TanStack Query; formatadores pt-BR (número, moeda, percentual, data); página "Início" com dados de `/me`.
  - Aceite: login real no Entra ID funcionando em homologação; modo DEV funcionando localmente; layout testado em 360 px e 1440 px.

- [x] **P11 — Cadastros básicos**
  - Tarefas: API + telas de usuários (perfil, ativo, gerente geral, superior), setores, ciclos (criar, listar; ativar fica no P15), feriados, responsáveis por setor no ciclo e setores do Leitor; auditoria em todas as alterações.
  - Aceite: só ADMIN altera; testes de API para permissão e validação; auditoria registrada com antes/depois.

### Etapa 2 — Metas e produção (07/12 a 23/12/2026)

- [x] **P12 — Variáveis**
  - Tarefas: API + tela de variáveis por ciclo e setor (tipo, acumulação, origem, responsável no Corporativo, casas decimais); lista "usada por" (metas); renomear código atualiza fórmulas que a usam (RF-21) dentro de uma transação.
  - Aceite: testes de unicidade (ciclo, setor, código), da renomeação e de permissão.

- [x] **P13 — Metas (API)**
  - Tarefas: CRUD de metas com submetas, objetivos (único ou mensal), atribuições; ao salvar: validar fórmula com o motor, gravar AST e `meta_variavel`, validar `validarMeta()`; incrementar `versao` e auditar; inativar em vez de excluir quando houver lançamentos; `POST /formulas/validar`.
  - Aceite: testes para fórmula inválida, variável inexistente, neto proibido, pesos internos ≠ 100%, proporcional com objetivo ≤ 0, meta corporativa com várias atribuições.

- [x] **P14 — Editor de metas (web)**
  - Tarefas: lista de metas por ciclo/setor/gestor; editor em 5 etapas (o que é; variáveis; fórmula com chips de inserção e teste com valores; acumulação e período; objetivo, operador, peso e pontuação) com frase-resumo "Bate quando…"; gestão de submetas com soma de pesos ao vivo; usar o motor no navegador para a prévia. Referência visual: protótipo interativo já publicado.
  - Aceite: o Administrador cadastra do zero as metas de um gestor de exemplo (ex.: Julia, com Engajamento e 5 submetas) sem ajuda; funciona em tablet.

- [x] **P15 — Consistência e ativação do ciclo**
  - Tarefas: `GET /ciclos/{id}/consistencia` (pesos por gestor RN-03, submetas somando 100%, fórmulas válidas, variáveis sem responsável, setores sem responsável); tela com a lista de problemas; `POST /ciclos/{id}/ativar` bloqueado se houver problema; encerrar ciclo grava `nota_fechamento`.
  - Aceite: CT-17 na API; ciclo inconsistente não ativa.

- [ ] **P16 — Primeira instalação em produção**
  - Tarefas: escrever `docs/deploy-windows.md` (IIS + URL Rewrite + ARR, regra de proxy `/api` → Node, HTTPS com o certificado disponível, serviços NSSM para `api` e `jobs`, variáveis de ambiente, usuário de banco com privilégios mínimos, `prisma migrate deploy`, backup diário com `pg_dump` e retenção de 30 dias, teste de restauração); script PowerShell de deploy a partir do build; instalar em produção.
  - Aceite: Administrador acessa a produção pelo celular na rede interna, com login Microsoft, e começa a cadastrar as metas de 2027.

### Etapa 3 — Lançamentos: Entrega 1a (04/01 a 22/01/2027)

- [x] **P17 — Serviço de resultados**
  - Tarefas: `ResultadosService` carrega definições e lançamentos de um escopo, chama o motor e grava `resultado_meta_mes`, `resultado_meta`, `resultado_atribuicao`, `nota_gestor` na mesma transação; recálculo por evento (lançamento → metas que usam a variável → mães → notas dos gestores atribuídos); `GET /resultados/gestor/{id}` e `GET /resultados/meta/{id}` (com memória de cálculo).
  - Aceite: teste de integração reproduzindo CT-01, CT-12 e CT-15 pela API; recálculo de um ciclo de 150 metas em menos de 1 s.

- [x] **P18 — Lançamentos (API)**
  - Tarefas: `GET /lancamentos?ciclo&mes` (variáveis do usuário agrupadas por meta, valor, versão, status do mês e data de fechamento); `PUT /lancamentos` em lote: valida permissão (`podeLancar`), status do mês (motor P06 + reaberturas), tipo e faixa do valor; grava valor + histórico; conflito de versão → `CONFLITO_VERSAO`; dispara recálculo.
  - Aceite: testes para mês fechado (`MES_FECHADO`), mês futuro (`MES_FUTURO`), variável de outro setor (`SEM_PERMISSAO_VARIAVEL`), vazio vs zero, conflito de versão, histórico gravado.

- [x] **P19 — Tela de lançamentos (web)**
  - Tarefas: pensada primeiro para celular; seletor de mês com estados (aberto, fechado com cadeado, futuro desabilitado) e prazo ("fecha em 24/11 — faltam 9 dias úteis"); variáveis agrupadas por meta, compartilhadas aparecem uma vez; entrada com vírgula decimal; percentual de 0 a 100; SIM/NÃO como seleção; prévia do resultado do mês e do acumulado com o motor; salvar em lote; tratar conflito mostrando o valor atual.
  - Aceite: teste de componente da prévia; usável com uma mão num celular de 360 px.

- [x] **P20 — Minhas metas e Início**
  - Tarefas: notas por bloco e total; lista de metas com acumulado, atendimento, pontos e situação (texto + cor, nunca só cor); detalhe com resultado mês a mês e memória de cálculo; Início com nota parcial e pendências do mês.
  - Aceite: números batem com a API e com os casos de teste usados como dados de exemplo.

- [ ] **P21 — Entrega 1a**
  - Tarefas: E2E com Playwright (login DEV → lançar → ver resultado → mês fechado recusado); `pnpm audit`; revisão de segurança da seção 6 item a item; deploy; roteiro de treinamento de 1 hora para gestores em `docs/treinamento.md`.
  - Aceite: gestores conseguem lançar janeiro/2027 em produção.

### Etapa 4 — Entrega 1b (25/01 a 12/02/2027)

- [ ] **P22 — Serviço de jobs**
  - Tarefas: `apps/jobs` com pg-boss; job diário 00h05 (America/Sao_Paulo) que atualiza status de meses e encerra reaberturas vencidas; estrutura pronta para os e-mails da Fase 2; log de execução.
  - Aceite: teste do job com relógio simulado; serviço instalado via NSSM.

- [ ] **P23 — Reabertura**
  - Tarefas: API + tela do Administrador (ciclo, mês, escopo, data-limite, motivo, autorizador); valores gravados durante a reabertura ligados a ela no histórico; cancelar antes do prazo.
  - Aceite: CT-18 completo via API (fechado → reaberto → fechado de novo).

- [ ] **P24 — Importação Excel e carga histórica**
  - Tarefas: `GET /importacao/modelo` (colunas: ciclo, mês, setor, código da variável, valor); `POST /importacao/previa` (validação linha a linha: variável existe, tipo, faixa, mês, permissão, trava; mostra antes → depois); `POST /importacao/{id}/confirmar` em transação única; modo `CARGA_HISTORICA` só para ADMIN; tela com upload, prévia e confirmação; limite de tamanho do arquivo.
  - Aceite: importar 5.000 linhas em menos de 30 s; arquivo com 1 linha inválida não grava nada.

- [ ] **P25 — Catálogo de modelos**
  - Tarefas: CRUD de modelos; "Aplicar modelo" a vários setores/gestores com peso, objetivo e período por destino, criando variáveis e metas (cópia, não vínculo); mostrar onde cada modelo foi aplicado.
  - Aceite: aplicar "Check lists" a 5 setores numa operação.

- [ ] **P26 — Visão geral e exportação**
  - Tarefas: tela da Diretoria/Admin/Leitor com todos os gestores, notas por bloco e pendências por mês (respeitando permissões); `GET /exportacao` em Excel (metas do gestor com resultados mensais e nota).
  - Aceite: Leitor vê só os setores liberados.

- [ ] **P27 — Schema `bi`**
  - Tarefas: migração com as views da seção 9.2 e o usuário `bi_leitor` só com `SELECT` no schema `bi`; documentar conexão do Power BI Desktop.
  - Aceite: `bi_leitor` não consegue ler nem escrever fora de `bi`.

- [ ] **P28 — Entrega 1b**
  - Tarefas: E2E de importação; `pnpm audit`; deploy; Administrador carrega os dados de 2026.
  - Aceite: dados de 2026 no sistema; tudo pronto antes de 19/02/2027.

### Fase 2 — Governança e gestão (março a maio/2027)

Detalhar cada passo com o desenvolvedor antes de começar. Ordem sugerida:

- [ ] **P29 — Pedido de correção** com aprovação do Gerente Geral (RN-37), impacto calculado na tela de aprovação.
- [ ] **P30 — E-mails** via Microsoft Graph ou SMTP: lembretes a 5 e 2 dias úteis, pendências para a Diretoria, avisos de correção.
- [ ] **P31 — Evidências e comentários** (até 10 MB, PDF, imagem, Excel, Word).
- [ ] **P32 — Avaliação de comportamentos** (32 comportamentos, 8 competências, notas 1–5, 3 momentos) e ligação com "Modelo de liderança" (RN-43).
- [ ] **P33 — Cópia de ciclo, `ANTERIOR()` e `META()`** nas fórmulas, com detecção de referência circular.
- [ ] **P34 — Dashboard nativo**, conforme o layout que será enviado.

---

## 11. Variáveis de ambiente (`.env.example`)

```
NODE_ENV=development
PORT_API=3000
DATABASE_URL=postgresql://metas_app:senha@localhost:5432/metas
ENTRA_TENANT_ID=
ENTRA_API_AUDIENCE=api://metas
ENTRA_SPA_CLIENT_ID=
WEB_ORIGIN=http://localhost:5173
AUTH_DEV=false
AUTH_DEV_EMAIL=
SEED_ADMIN_EMAIL=
TZ_REGRAS=America/Sao_Paulo
LOG_LEVEL=info
EVIDENCIAS_DIR=D:\metas-dados\evidencias
```

No front (Vite): `VITE_ENTRA_CLIENT_ID`, `VITE_ENTRA_TENANT_ID`, `VITE_API_SCOPE`, `VITE_API_URL`, `VITE_AUTH_DEV`.

---

## 12. Registro de progresso

Adicione uma linha ao concluir cada passo. Seja específico sobre desvios e pendências.

| Data | Passo | Resumo do que foi feito | Desvios ou pendências |
| --- | --- | --- | --- |
| 11/11/2026 | P01 | `git init`; pnpm workspaces com `apps/api`, `apps/jobs`, `apps/web`, `packages/motor`, `packages/tipos`; `tsconfig.base.json` estrito; ESLint flat (`strictTypeChecked`, `no-eval`, `no-new-func`) + Prettier; Vitest e um teste trivial por pacote; `.editorconfig`, `.gitattributes`, `.gitignore`, `.nvmrc`, `.env.example`; scripts da 5.6; README; `docs/decisoes.md` com modelo e ADR-001 a 004. `pnpm verify` e `pnpm build` verdes, inclusive numa cópia limpa; `pnpm audit`: 1 moderada, `minimatch <11.0.1` via `eslint` (só desenvolvimento; DoS com padrões glob maliciosos, que não se aplica). | Rever o `minimatch` quando o ESLint atualizar; correção exige mudar de versão major, por isso não forcei `overrides`. TypeScript 6.0.3 em vez do 7 (ADR-002). `pnpm dev` ainda não sobe serviços (vêm no P08/P10). Forma de consumo de `motor`/`tipos` pela api/web fica para o P02. |
| 11/11/2026 | P02 | `@metas/tipos`: 14 enums da 9.1 (`as const` + tipo + schema Zod), `CodigoErro` e `ErroApiSchema` (5.3), `MesSchema`, `MesObjetivoSchema` (0 = único), `DecimalStringSchema` (formato com ponto e limites de `numeric(18,6)`), `UuidSchema`, `PaginacaoSchema` (padrão 50, máx. 200), mensagens em pt-BR. 95 testes no `tipos`; `motor`, `api` e `web` importam o pacote em teste. Consumo via condição `@metas/source` (ADR-005): src no editor/testes, dist no build; testado sem `dist` e com o `dist` carregado no Node por CJS e ESM. | `motor` e `tipos` mudaram para `moduleResolution: NodeNext` (ajuste do ADR-003). Tamanho máximo de página (200) não está na especificação: escolha técnica, fácil de mudar. `pnpm audit`: só o `minimatch` do P01. |
| 11/11/2026 | P03 | `motor/src/formula`: `ast.ts` (nós serializáveis com `posicao`), `erros.ts` (`FormulaErro`, código `FORMULA_INVALIDA`), `tokenizer.ts` (números com ponto/vírgula, `SETOR.VAR`, operadores, `;`/`,`, normalização para maiúsculas), `parser.ts` (descendente recursivo, precedência da 8.1, funções com 0..N argumentos). 108 testes: cada token, precedência, parênteses, unário, funções, `SETOR.VAR`, ambiguidade da vírgula e 29 entradas inválidas com mensagem e posição, incluindo o exemplo exato da 8.1. Cobertura 100% exigida no `pnpm test` do motor. | Decisões de sintaxe não fixadas na especificação no ADR-006 (ex.: `ARRED(3, 2)` com espaço tem 2 argumentos; limite de 100 níveis de aninhamento). `pnpm audit`: só o `minimatch` do P01. |
| 11/11/2026 | P04 | `motor/src/formula`: `decimal.ts` (clone do decimal.js: 40 dígitos, meio para cima), `funcoes.ts` (SE, E, OU, NAO, ARRED, MIN, MAX, ABS com aridade), `avaliador.ts` (`avaliar(ast, escopo)` → `{ valor, avisos }`; comparação 1/0; divisão por zero → `null` + `DIVISAO_POR_ZERO`; variável vazia → `null`; `SE` preguiçoso), `validador.ts` (`validar(texto, disponiveis)` com todos os erros e sugestão de `;`), `variaveis.ts` (`variaveisUsadas`, `chaveVariavel`). 222 testes no motor, 100% de cobertura; `0.1 + 0.2 = 0.3` exato; `dist` testado por ESM e CJS. | Semântica não fixada na especificação no ADR-007 (ex.: `SE` só avalia o ramo escolhido; variável vazia em ramo não escolhido ainda deixa o resultado vazio). `pnpm audit`: só o `minimatch` do P01. |
| 11/11/2026 | P05 | `motor/src/calculo`: `acumulacao` (8.2), `atendimento` (8.4), `pontuacao` (8.5), `arredondamento` (5.4), `meta` (`calcularMeta`: mensal 1–12 com `foraPeriodo`, acumulado pelos 5 modos, objetivo do último mês ou único, submetas e componente próprio da mãe, memória de cálculo), `nota` (`calcularCiclo`: pontos por atribuição, nota por bloco e final), `validacao` (`validarMeta`, `validarPesosGestor`). CT-01 a CT-17 passando como testes nomeados, com os números da 8.7 conferidos também em Python; 358 testes no motor, 100% de cobertura. | Interpretações no ADR-008: atendimento da mãe dividido pela soma dos pesos; meta sem objetivo → aviso `SEM_OBJETIVO`; RN-23 só em meta pontuada e não FAIXA. CT-12 montado com submetas reais cujas filhas dão 99,54% / 100% / 100% / 0% / 100%. `pnpm audit`: só o `minimatch` do P01. |
| 11/11/2026 | P06 | `motor/src/calendario`: `ehDiaUtil`, `diasUteis`, `dataFechamento` (23:59:59.999 do 15º dia útil de M+1), `statusMes` (`FUTURO`/`ABERTO`/`REABERTO`/`FECHADO`), `noFusoDasRegras`; tudo em America/Sao_Paulo com Luxon. `StatusMes` em `@metas/tipos`. CT-18 completo (aberto 24/11 23:59, fechado 25/11 00:00, reaberto até 27/11, fechado de novo), dezembro/2026 → 22/01/2027, virada de ano, feriado no 1º dia útil (abril/2026 → 22/05), Carnaval 2027 (19/02 ou 23/02). Datas conferidas em Python; testes passam com o processo em UTC, Tóquio e Los Angeles. 399 testes no motor, 100% de cobertura. | Fuso como constante do motor, não `TZ_REGRAS` (ADR-009). Escopo da reabertura filtrado pela API. `pnpm audit`: só o `minimatch` do P01. Etapa 1 do motor concluída (P03–P06). |
| 11/11/2026 | P07 | PostgreSQL 18.4 no Docker (porta 5433) com `metas_owner` e `metas_app` (privilégios mínimos) e bancos `metas`/`metas_teste`; pacote `@metas/prisma` com `schema.prisma` (23 tabelas da 9.2, 15 enums), migração `inicial` com CHECKs, índices únicos parciais (Corporativo, ciclo ATIVO), trigger de 2 níveis, bloqueio de UPDATE/DELETE/TRUNCATE em histórico e auditoria e trigger de `atualizado_em`; seed idempotente que recusa produção; `criarPrismaClient` (Prisma 7 + adapter pg). 32 testes de integração no banco real (cada um numa transação desfeita); repositório limpo instala, gera o client e passa no `verify`. | **Versão do PostgreSQL de produção a confirmar antes do P16.** Variáveis novas no `.env.example` (`DATABASE_URL_MIGRACAO`, `DATABASE_URL_TESTE` e senhas do Docker). `importacao.status` como texto até o P24. `pnpm verify` agora exige o banco no ar. Prisma 7.10.1 (o `latest` do npm é RC da 8). Detalhes no ADR-010. `pnpm audit`: só o `minimatch` do P01. |
| 11/11/2026 | P08 | `apps/api` em NestJS 12 (ESM): config com Zod (lista os problemas e não inicia), `nestjs-pino` com `requestId` (`X-Request-Id`), `ErroApi` + filtro global no formato 5.3 (exceções do Nest, Zod, JSON malformado, 404, 429, 500 sem vazar detalhes), pipe `ValidacaoZod`, `PrismaService`, `GET /api/v1/saude` (200/503), OpenAPI em `/api/v1/docs` fora de produção, `helmet`, CORS só para `WEB_ORIGIN`, limite de taxa nas escritas. 26 testes (config, filtro de erros, cabeçalhos, CORS, limite, saúde com banco real e com banco fora). API sobe com `pnpm dev` e compilada (`node dist/main.js`). | NestJS 12 é só ESM: `api` e `jobs` passaram para ESM (ADR-011, substitui parte do ADR-003). Código novo `MUITAS_REQUISICOES`. Regras de negócio respondem 422. `@metas/prisma` ganhou build; `pnpm dev` compila os pacotes internos antes. `pnpm audit`: só o `minimatch` do P01. |
| 11/11/2026 | Ajuste P07 | PostgreSQL de desenvolvimento trocado de 18.4 para **17.11** (`postgres:17.11-alpine`), a versão major da produção confirmada pelo desenvolvedor; volume recriado, migração `inicial` aplicada sem mudança, seed refeito; teste de `ON DELETE RESTRICT` ajustado ao SQLSTATE do 17 (`23503`). `pnpm verify` verde. | Resolve a pendência de versão do P07 (ADR-012). Quem tinha o volume do 18 precisa recriá-lo. `pnpm audit`: só o `minimatch` do P01. |
| 11/11/2026 | P09 | `AuthGuard` global com `jose` (RS256, JWKS do tenant, emissor v2, audiência, expiração, exige `oid` e `scp`); `@Publica()` (saúde), `@PermiteInativo()` (`/me`) e `@Perfis(...)` decidido pelo `PoliticasService`; primeiro acesso: `oid` → pré-cadastro pelo e-mail (liga o `oid`) → Leitor inativo, com auditoria; `GET /me` com `SessaoSchema` (`@metas/tipos`); modo DEV com `X-Usuario-Dev` e trava (só `development`); `PoliticasService` puro (cadastros, metas, ver meta/submeta, histórico, `podeLancar`, carga histórica). 97 testes na API: token ausente, inválido, outra chave, expirado, sem `exp`, outro tenant, emissor v1, outra audiência, sem `scp`/`oid`, inativo de cada perfil, cada perfil, provisionamento (inclusive simultâneo), vínculo por e-mail, conflito de e-mail, setores do `/me`, modo DEV, trava de produção. API compilada sobe e responde `/me` no modo DEV. | Decisões no ADR-013: inativo só acessa `/me` e submeta visível pela mãe (confirmados pelo desenvolvedor); `ENTRA_API_AUDIENCE` aceita lista (GUID do aplicativo + URI), a confirmar na homologação; pendências do `/me` ficam para o P18/P20. `.env` local com `AUTH_DEV=true`. `pnpm audit`: só o `minimatch` do P01. |

---
| 12/11/2026 | P10 (parcial) | `apps/web` com Vite 8 + React 18 + MUI 9 + React Router 7 + TanStack Query 5: config `VITE_*` validada com Zod; MSAL (redirect + PKCE, `MsalAuthenticationTemplate`, token silencioso, novo login só em `TOKEN_EXPIRADO`); modo DEV com usuário simulado trocável pelo chip "DEV" (fora do build de produção, conferido no `dist`); cliente HTTP com `ErroApi` no formato 5.3 (sem rede/resposta inesperada com mensagem própria); layout com menu lateral (≥ 900 px) e gaveta (celular/tablet), itens por perfil, telas futuras "em construção (Pxx)"; formatadores pt-BR com o `Decimal` do motor; Início com perfil, e-mail, setores, aviso de inativo e atalhos; tema com cores e Montserrat do site da empresa. 54 testes na web (formatação, config, cliente, modo DEV, menu, layout em 360 e 1440 px). Conferido no Edge com a API real: 1440 px e 360 px (emulação de celular, sem rolagem horizontal, gaveta abre e fecha). | **Falta o critério "login real no Entra ID em homologação"**: precisa de `VITE_ENTRA_CLIENT_ID`/`VITE_ENTRA_TENANT_ID`/`ENTRA_TENANT_ID` e da URI de redirecionamento SPA no registro do aplicativo. Build fixa `NODE_ENV=production` (o `.env` da raiz empacotava o React de desenvolvimento) com `shellEmulator` do pnpm. Tela Histórico da especificação 10.2 sem passo no plano (fora do menu). React Hook Form e ECharts adiados para quando houver formulário/gráfico. Detalhes no ADR-014. `pnpm audit`: só o `minimatch` do P01. |
| 12/11/2026 | Ajuste P10 | Identidade visual da ECTAS a pedido do desenvolvedor: levantamento do site com firecrawl (marca e captura) e do logotipo original; cores do logotipo (marinho `#13314D`, azul `#0073A8`, turquesa `#59BDBC`), Montserrat, menu lateral marinho com as três ondas e o slogan, faixa de água com borda ondulada no Início, marca d'água, favicon; revisão pelas Web Interface Guidelines (foco visível, áreas seguras, `prefers-reduced-motion`, imagens com dimensões). Conferido no Edge em 1440 e 360 px. 54 testes da web passando. | Detalhes no ADR-015. P10 continua aguardando o login real no Entra ID. |
| 12/11/2026 | P11 | API de cadastros só para Admin: usuários (lista paginada com busca, pré-cadastro pelo e-mail, superior sem ciclos, setores do Leitor), setores (Corporativo único, não inativa/exclui; código fixo depois de variáveis/metas), ciclos (criar em Rascunho, listar), responsáveis por setor no ciclo (só Gestor ativo; ciclo encerrado recusa), feriados (trava de meses fechados com o `dataFechamento` do motor); exclusão só sem registros associados; auditoria antes/depois na mesma transação; códigos `JA_EXISTE` e `EM_USO`. Web: tela Cadastros em 4 abas (URL), React Hook Form + Zod, lista que vira cartões no celular, confirmação de exclusão, avisos. Testes: 29 de integração na API (permissão de cada perfil, validação, unicidade, auditoria, trava), 15 de componentes na web, 18 de schemas. Conferido no Edge (1440 e 360 px) e de ponta a ponta na API real. | Regras decididas pelo desenvolvedor no ADR-016 (exclusão, feriados, Gerente Geral, responsável). React Hook Form 7.92.0 e `@hookform/resolvers` 7.0.6. A API passou a depender do `@metas/motor`. Ativar/encerrar ciclo e a tela Ciclos e consistência ficam no P15. `pnpm audit`: só o `minimatch` do P01. |
| 12/11/2026 | P12 | `@metas/motor`: `renomearVariavel` pelos tokens (código simples no setor da variável e `SETOR.VAR` em qualquer setor), 100% de cobertura. `@metas/tipos`: `VariavelSchema` (com `usadaPor` e `temLancamentos`), `VariavelEntradaSchema` (SIM/NÃO sem casas), códigos reservados (nomes de função). API só Admin em `/ciclos/{id}/variaveis`: CRUD com auditoria, ciclo encerrado recusa, responsável próprio só no Corporativo e só Gestor ativo, travas de tipo/acumulação/setor com lançamentos ou metas, não inativa com meta ativa usando, exclusão só sem registros; trocar o código reescreve texto e AST das fórmulas, sobe a versão e audita cada meta na mesma transação (RF-21). Web: tela Variáveis com ciclo, filtro por setor, busca, "Usada por", diálogo com campos travados explicados e aviso de renomeação; `SeletorCiclo` extraído. Testes: 23 de integração na API (unicidade, renomeação, transação, travas, permissão de cada perfil), 10 de componentes na web, 17 de schemas, 9 do motor. Conferido no Edge em 1440 e 360 px. | Decisões no ADR-017. `pnpm test` dos pacotes em sequência (prisma e api usam o mesmo banco; carga estourava timeouts). **Queda intermitente `0xC0000409` nos testes da API já existia no P11** (≈1 em 10); investigar à parte. Quatro variáveis de exemplo criadas no banco de dev (ciclo 2027). `pnpm audit`: só o `minimatch` do P01. |
| 12/11/2026 | P13 | `@metas/tipos`: `MetaEntradaSchema` (meta com submetas, objetivos e atribuições; objetivo único ou mensal no período; recusa submeta com submetas), `MetaAlteracaoSchema` (com `versao`), `MetaSchema`, `ValidarFormula*`. API: `GET/POST /ciclos/{id}/metas`, `GET/PUT/DELETE /metas/{id}`, `POST /formulas/validar`; salva a árvore inteira numa transação, valida fórmulas com o motor (variáveis ativas, `CODIGO` e `SETOR.CODIGO`), grava AST e `meta_variavel`, roda `validarMeta`, controle otimista (`CONFLITO_VERSAO`), auditoria antes/depois; departamental atribuída só ao responsável, corporativa a vários; exclusão só sem valor lançado (senão inativar); leitura filtrada por `podeVerMeta`. Testes: 29 de integração (todos os critérios de aceite: fórmula inválida, variável inexistente, neto, pesos internos, RN-23, corporativa com várias atribuições; e mais permissão, conflito de versão, submetas, exclusão), 18 de schemas. Conferido na API de dev. | Decisões no ADR-018. Rotas `PUT /metas/{id}/objetivos` e `/atribuicoes` cobertas pelo PUT inteiro. Queda `0xC0000409` nos testes da API mais frequente (uma rodada do `verify` caiu, a seguinte passou); causa ainda não encontrada, investigar num passo próprio. `pnpm audit`: só o `minimatch` do P01. |
| 12/11/2026 | Correção dos testes da API | Investigada a queda `0xC0000409` (ADR-017/018): é um defeito do Node 24.15 no Windows ao abrir e fechar milhares de conexões TCP num processo filho com IPC (o worker do Vitest) enquanto fala com o banco; reproduzido fora do Vitest com `fork`, e some com conexões reaproveitadas (0/15 contra 3/15). `criarApp` escuta uma vez e o novo `cliente(app)` usa um agente keep-alive; todos os testes da API migrados. 8 rodadas completas da API e 2 `verify` seguidos sem queda. | Detalhes e tabela dos experimentos no ADR-019. Uma falha isolada do teste de primeiro acesso simultâneo não se repetiu (50+ execuções, estresse com 300 acessos); o teste agora mostra o código do erro. Repetir o experimento quando houver Node 24 mais novo. |
| 12/11/2026 | P14 | Web: `/metas` (lista por ciclo com filtros de setor, gestor e busca; excluir só sem lançamentos) e editor `/metas/nova` e `/metas/:id` com as 5 etapas (o que é; variáveis do setor e de outros setores, criação na hora; fórmula com chips na posição do cursor, validação ao vivo pelo motor e teste com valores; acumulação e período; objetivo único ou mensal, operador, tolerância, pontuação, atribuições e pesos), barra de partes (meta principal e submetas) com a soma dos pesos internos ao vivo, frase "Bate quando…" e "Vale…". Números digitados em pt-BR e convertidos com `Decimal`. Testes: 20 da camada pura (conversões, frase-resumo com CT-01/03/04/16) e 8 de componentes (fluxo completo CT-01 com prévia 16/20 = 80,00%, erro de fórmula ao vivo, validação antes de enviar, submetas com soma ao vivo e PUT com versão, conflito de versão, tablet). Conferido no Edge em 1440, 768 e 360 px; metas de exemplo FISCAL_PRAZO e FAB_ENGAJAMENTO (5 submetas de 20%) salvas pela tela contra a API real. | Detalhes no ADR-020. Protótipo de referência não disponível; se houver o link, ajustar o visual. Defeito encontrado no navegador e corrigido (a tela não voltava para a lista depois de salvar), com teste. Critério "o Administrador cadastra sem ajuda" depende da sua avaliação de uso. `pnpm audit`: só o `minimatch` do P01. |
| 12/11/2026 | P15 | `@metas/tipos`: `ConsistenciaCicloSchema` (problemas com gravidade `BLOQUEIA`/`AVISO`, pesos por gestor, encerramento), códigos `CICLO_INCONSISTENTE` e `STATUS_CICLO_INVALIDO`. API: `GET /ciclos/{id}/consistencia`, `POST /ciclos/{id}/ativar` (reavalia na transação, bloqueia com a lista de problemas, audita) e `POST /ciclos/{id}/encerrar` (calcula o ciclo com o motor e grava `nota_fechamento` por gestor e bloco, com as metas em `dados`; audita); `carregarCiclo` monta a entrada do motor a partir do banco. Web: tela Ciclos e consistência com etapas do ciclo, pesos por gestor (tabela/cartões), problemas com link para resolver e confirmação de ativar/encerrar. Testes: 22 de integração (CT-17 na API, ciclo inconsistente não ativa, cada bloqueio e aviso, outro ciclo ativo, prazo de dezembro, reabertura em vigor, encerramento com CT-01 e CT-15 congelados, permissão de cada perfil, auditoria), 6 de componentes, 3 de schemas. Conferido no Edge em 1440 e 360 px com os dados de dev. | Regras decididas pelo desenvolvedor no ADR-021 (um ciclo ativo por vez; encerrar só depois do prazo de dezembro e sem reabertura; lista do que bloqueia e do que avisa). `carregarCiclo` antecipado do P17 (o encerramento depende dele). Limite dos testes da web subiu para 15 s (disputa de CPU com 12 arquivos em paralelo). Aviso de consultas simultâneas do `pg` vem do Prisma 7 e já existia. `pnpm audit`: só o `minimatch` do P01. |
| 13/11/2026 | P16 (parcial) | `docs/deploy-windows.md` (roteiro do servidor ao backup, com o que pedir à TI e problemas comuns); `deploy/empacotar.ps1` gera um `.zip` de ~115 MB com a API (`pnpm deploy` com `node_modules` plano, sem links), a web com `web.config`, as migrações e os scripts; `deploy/servidor/`: `instalar-servico.ps1` (pastas e permissões por SID, proxy do ARR, site HTTPS, serviço NSSM com LOCAL SERVICE), `publicar.ps1` (backup, migração, troca de versão e volta automática se a API não responder), `voltar-versao.ps1`, `backup.ps1` (pg_dump, conferência, 30 dias, agendamento), `testar-restauracao.ps1`, `criar-banco.sql` (`metas_owner`/`metas_app`), `criar-admin.sql` (primeiro Administrador, auditado), `api.env.example`, `web.config` (proxy `/api`, SPA, CSP e cabeçalhos). Testado aqui: pacote, banco novo do zero (PostgreSQL 17.11 descartável), privilégios do `metas_app`, API do pacote com `--env-file`, backup e restauração, CSP no Edge sem violações e redirecionamento ao login Microsoft. | **Falta a instalação no servidor** (aceite do P16): certificado HTTPS, registro do aplicativo no Entra ID (o mesmo do P10) e a execução do roteiro. `instalar-servico.ps1` e o fluxo IIS/NSSM do `publicar.ps1` só podem ser testados no servidor. `prisma` virou dependência de produção do `@metas/prisma`. Serviço `metas-jobs` fica para o P22. API em produção não lê `.env`. Detalhes no ADR-022. `pnpm audit`: só o `minimatch` do P01. |
| 13/11/2026 | P17 | `@metas/tipos`: `ResultadoMetaSchema` (mês a mês, acumulado, submetas, pontos por atribuição, memória), `ResultadosGestorSchema` (metas e notas por bloco), `RecalculoSchema`. API: `ResultadosService` grava `resultado_meta_mes`, `resultado_meta`, `resultado_atribuicao` e `nota_gestor` na transação de quem muda, com lock por ciclo; recálculo por evento (meta criada/alterada/inativada/excluída, variável alterada, encerramento; `recalcularPorVariaveis` pronto para o P18); `GET /resultados/gestor/{id}?ciclo`, `GET /resultados/meta/{id}` e `POST /ciclos/{id}/recalcular` (Admin); permissões no `PoliticasService`. Testes: 21 de integração (CT-01, CT-12 e CT-15 pela API, notas, recálculo por evento, cada perfil, ciclo encerrado, 150 metas), 6 de políticas, 3 de schemas. | Decisão do desenvolvedor no ADR-023: Leitor vê só as metas dos setores liberados, sem as notas. **Recálculo de 150 metas, 300 variáveis e 12 meses: ~170 ms** (era ~680 ms com o `createMany` do Prisma; gravação em lote por `jsonb_to_recordset`). Meta inativa sem resultado; Gestor vê só os próprios pontos numa corporativa; `POST /ciclos/{id}/recalcular` fora do plano (testes e manutenção). Metas de dev salvas antes do P17 precisam de recálculo. `pnpm audit`: só o `minimatch` do P01. |
| 13/11/2026 | P18 | `@metas/tipos`: `LancamentosMesSchema` (variáveis com status por variável, valor, versão e valores do ano; metas com a definição para a prévia), `LancamentosEntradaSchema` (lote até 500, sem repetição), `ConflitoLancamentoSchema`, `ProblemaLancamentoSchema`. API: `GET /lancamentos?ciclo&mes` e `PUT /lancamentos` (Gestor no ciclo ativo, nas suas variáveis e meses abertos ou reabertos; Administrador como carga histórica, menos em ciclo encerrado); validação do lote inteiro com o erro mais grave (`SEM_PERMISSAO_VARIAVEL`, `MES_FUTURO`, `MES_FECHADO`, `VALIDACAO`); `CONFLITO_VERSAO` com o valor atual; histórico ligado à reabertura; recálculo das metas; `Relogio` injetável. Testes: 24 de integração (mês fechado, futuro, reaberto por setor, variável de outro setor e do Corporativo, vazio vs zero, conflito de versão, histórico, valor igual, regras do valor, carga histórica, ciclo rascunho e encerrado, cada perfil, recálculo), 3 de schemas. | Regra do valor decidida pelo desenvolvedor no ADR-024 (só SIM/NÃO e casas decimais). Auditoria dos lançamentos fica no `lancamento_historico`. Limpeza dos testes apaga o histórico de lançamentos. Esperas da Testing Library na web subiram para 5 s (testes que não mudaram falhavam de forma alternada sob carga). `pnpm audit`: só o `minimatch` do P01. |
| 13/11/2026 | P19 | Web: `/lancamentos` pensada para celular: seletor de 12 meses (cadeado no fechado, ponto nas pendências, futuro desabilitado) com o prazo e os dias úteis restantes; cartões por meta com a variável compartilhada uma vez só, as de outros setores só para leitura; campo com vírgula decimal, percentual de 0 a 100 e unidades; SIM/NÃO em botões (vazio não é Não); prévia do mês e do acumulado com o motor; barra de salvar fixa; conflito de versão com "Usar o salvo" ou "Manter o meu"; confirmação ao trocar de mês com valores não salvos. API do P18: `ciclo`/`mes` opcionais (ciclo ativo e mês aberto mais antigo com pendências) e `meses` na resposta. Motor: `diasUteisRestantes`. Testes: 9 da camada pura (leitura do campo, agrupamento, prévia do CT-01), 9 de componentes (prévia ao digitar, salvar com versão, valor inválido, conflito, mês fechado, troca de mês, 360 px, sem ciclo ativo), 1 de integração na API, 4 do motor. Conferido no Edge em 1440 e 360 px como Gestor. | Detalhes no ADR-025. Ciclo 2026 ativo de exemplo criado no banco de dev (CT-01 e SIM/NÃO do Leonardo, jan–set em carga histórica). Critério "usável com uma mão" conferido pela tela de 360 px (alvos de 48 px, barra fixa embaixo); vale a sua avaliação no celular. `pnpm audit`: só o `minimatch` do P01. |
| 13/11/2026 | P20 | Web: `/minhas-metas` com a nota por bloco e total, metas por bloco (acumulado, objetivo com operador, atendimento, pontos e situação com texto e cor) e seletor de ano (ativo e encerrados); `/minhas-metas/{id}` com resumo, mês a mês (histórico fora do período), submetas e "Como foi calculado" (valores, acumulados, fórmula, objetivo usado, composição da mãe, explicação dos pontos, avisos); Início do Gestor com Pendências (meses terminados ainda abertos, variáveis que faltam, prazo, "Lançar mês") e Nota parcial. API: `?ciclo=` opcional em `/resultados/gestor/{id}` (`ciclo`, `ciclos`, `operador`, `tolerancia`), memória tipada (`MemoriaCalculoSchema`) e `variaveis` no resultado da meta, rascunho oculto para Gestor e Leitor, `GET /lancamentos/pendencias`. Testes: 4 de integração em resultados, 1 em lançamentos, 1 de políticas, 4 de schemas, 9 da camada pura, 13 de componentes (CT-01, CT-12 e CT-15 na lista e no detalhe, seletor de ano, 360 px, Início). Conferido no Edge em 1440 e 360 px como Leonardo, com os números batendo com a API (88,79 de 100; outubro com 3 pendências e 7 dias úteis). | Decisões do desenvolvedor no ADR-026 (ativo + encerrados; pendências só de meses terminados; Início dos outros perfis como está). `SituacaoMeta` compartilhado com a tela de lançamentos. Fluxo longo do editor do P14 com limite de 40 s (passava de 20 s com 16 arquivos em paralelo). `pnpm audit`: só o `minimatch` do P01. |
| 13/11/2026 | P21 (parcial) | E2E com Playwright 1.64.1 no Edge (`pnpm e2e`): banco próprio `metas_e2e_teste` preparado a cada rodada (migrações, limpeza, cenário CT-01 da Paula Fiscal), API compilada na 3100 e web na 5174 em modo DEV, relógio fixo em 13/11/2026 (`RELOGIO_FIXO`, só em desenvolvimento, com trava e testes); fluxo login DEV → Início (pendência e nota 83,33) → lançar outubro com prévia → Minhas metas (80,00%, Batida, 100 pontos, memória) → setembro fechado na tela e `422 MES_FECHADO` na API, em desktop e 360 px: 4 testes passando. `pnpm audit`: só o `minimatch` do P01. Revisão de segurança da seção 6 em `docs/revisao-seguranca.md`, com uma correção (ARR mandava o IP com a porta no `X-Forwarded-For`; `instalar-servico.ps1` agora desliga). Roteiro de treinamento de 1 hora em `docs/treinamento.md`. **Migração para o Node 26.13.1** (o WinGet atualizou a máquina; decisão do desenvolvedor): `.nvmrc`, `engines`, `@types/node` 26.6.6, pnpm pelo npm (sem corepack), README, §3, especificação e roteiro de deploy; `pnpm verify` verde no 26 (1.023 testes). | **Faltam o deploy e o aceite** ("gestores lançam janeiro/2027 em produção"): dependem da instalação do P16 e de janeiro. E2E fora do `verify` (sobe servidores, ~1 min). Pedir à TI para não atualizar o Node automaticamente. Defeito `0xC0000409` do ADR-019 não foi testado de novo no Node 26 (keep-alive mantido). Detalhes no ADR-027. |
| 13/11/2026 | P22 (parcial) | `apps/jobs` com pg-boss 12.38.0: fila `rotina-diaria` (`singleton`, 3 tentativas), cron `5 0 * * *` em America/Sao_Paulo e uma execução ao iniciar; rotina diária registra na auditoria (usuário vazio = sistema) os meses que fecharam no dia anterior com as pendências por gestor (mesma regra do Início), as reaberturas vencidas e a própria execução; recupera os dias perdidos (até 62), um dia por transação com lock, sem duplicar; `Notificador` como ponto de extensão dos e-mails da Fase 2 (hoje só log); config Zod; parada limpa no Ctrl+C do NSSM. Migração `schema_pgboss` (schema da fila com `USAGE, CREATE` só para o `metas_app`; pg-boss com `createSchema: false`). Deploy: `metas-jobs` no pacote, no `instalar-servico.ps1` (NSSM, LOCAL SERVICE, mesmo `api.env`), no `publicar.ps1` e no `voltar-versao.ps1`; roteiro e README. Testes: 15 nos jobs (CT-18 com relógio simulado e pendências, véspera, dezembro → 22/01/2027, recuperação, repetição, reabertura vencida e cancelada, rascunho, limite de dias, pg-boss como `metas_app`, config). Conferido: serviço compilado no banco de dev, pacote isolado com `NODE_ENV=production`, `pnpm dev`, sintaxe dos `.ps1`. `pnpm verify` (1.037 testes) e `pnpm e2e` verdes. | Decisões do desenvolvedor no ADR-028 (auditoria + log; recuperar dias perdidos). **Falta instalar o serviço no servidor** (aceite "serviço instalado via NSSM", depende do P16); servidor instalado antes precisa rodar `instalar-servico.ps1` de novo. `overrides` de `@types/react` 18.3.31 e `@types/react-dom` 18.3.7: o Prisma Studio (via `@metas/prisma` na web, P21) trazia os tipos do React 19 e quebrou a checagem de tipos da web. `pnpm audit`: só o `minimatch` do P01. |

## 13. Decisões técnicas

Registre aqui (e em `docs/decisoes.md`, com mais detalhe) toda decisão que não está neste arquivo: biblioteca escolhida, versão fixada, padrão adotado, desvio da especificação aprovado pelo desenvolvedor.

| Data | Decisão | Motivo |
| --- | --- | --- |
| 11/11/2026 | Versões exatas no `catalog` do `pnpm-workspace.yaml`: Node 24.15.0, pnpm 10.34.9, TypeScript 6.0.3, ESLint 10.14.0, typescript-eslint 8.72.2, Prettier 3.10.0, Vitest 5.1.0 (ADR-001) | Uma versão por ferramenta, sem `^` |
| 11/11/2026 | TypeScript 6.0.3 em vez do 7.0 (ADR-002) | `typescript-eslint` só suporta `<6.1.0` |
| 11/11/2026 | `motor`, `tipos`, `web` em ESM; `api` e `jobs` em CommonJS/NodeNext (ADR-003) | Padrão do NestJS; Node 24 tem `require(esm)` |
| 11/11/2026 | ESLint `strictTypeChecked` + proibição de `eval`/`new Function` (ADR-004) | Regras 2.2 e 5.1 |
| 11/11/2026 | Pacotes internos com `exports` na condição `@metas/source` (src) e `dist` no build; `motor`/`tipos` em NodeNext; `zod` 4.6.7 (ADR-005) | Código-fonte ao vivo no desenvolvimento, `dist` executável no Node em produção |
| 11/11/2026 | Detalhes da sintaxe de fórmulas (nomes ASCII, vírgula, sem `+` unário, comparação em cadeia, limite de aninhamento) e cobertura com `@vitest/coverage-v8` 5.1.0 (ADR-006) | Pontos que a 8.1 não fixa |
| 11/11/2026 | `decimal.js` 10.6.0 com clone próprio do motor (40 dígitos, `ROUND_HALF_UP`); `SE` preguiçoso; diferente de zero = verdadeiro; `ARRED` como no Excel (ADR-007) | Precisão sem afetar a configuração global; permitir proteger divisões com `SE` |
| 11/11/2026 | Motor de cálculo orientado a dados (`calcularMeta`, `calcularCiclo`), saída sem arredondar com funções de exibição, atendimento da mãe = Σpᵢ·atᵢ / Σpᵢ, aviso `SEM_OBJETIVO` (ADR-008) | Mesmo código na API e na web; casos-limite que a 8.3–8.6 não fixa |
| 11/11/2026 | Luxon 3.7.2; fuso `America/Sao_Paulo` como constante do motor; fechamento às 23:59:59.999; feriado inválido lança erro; `StatusMes` em `@metas/tipos` (ADR-009) | Mesmas regras no servidor e no navegador, independentes do fuso da máquina |
| 11/11/2026 | PostgreSQL 18.4 no Docker (porta 5433) para desenvolvimento; usuários `metas_owner` (migrações) e `metas_app` (aplicação); Prisma 7.10.1 + `@prisma/adapter-pg`; `prisma/` como pacote `@metas/prisma`; ids por `gen_random_uuid()` (ADR-010) | PostgreSQL nativo já ocupa a 5432; privilégios mínimos para a aplicação; mesmo client para API e jobs |
| 11/11/2026 | NestJS 12.4.2 em ESM; status HTTP por código de erro (422 para regras de negócio); `MUITAS_REQUISICOES`; nestjs-pino, helmet, throttler só em escritas, OpenAPI fora de produção (ADR-011) | NestJS 12 só existe em ESM; seção 5.3 e 6 |
| 11/11/2026 | PostgreSQL 17.11 no Docker de desenvolvimento, igual à produção (ADR-012) | Seção 3: mesma versão major do servidor de produção |
| 11/11/2026 | `jose` 6.2.17; guard global de login com exceções explícitas; primeiro acesso liga pré-cadastro pelo e-mail; inativo só vê `/me`; audiência do token como lista; `PoliticasService` com funções puras; limpeza dos dados de teste da API (ADR-013) | Seção 6 e 7.5; tokens v2 trazem o GUID do aplicativo em `aud` |
| 12/11/2026 | React Router 7.18.5 (o 8 exige React 19); MUI 9.5 com `react-is` 18.3.1 em `overrides`; MSAL browser 5.29 / react 5.8 por redirecionamento; Montserrat local; web resolve `@metas/*` pelo código-fonte; build com `NODE_ENV=production` e `shellEmulator`; modo DEV só no servidor do Vite (ADR-014) | Seção 3 (React 18); celular; regra do `.env` único da raiz |
| 12/11/2026 | Identidade da ECTAS: cores do logotipo, Montserrat, ondas como único elemento marcante, logotipo em PNG gerado do original (ADR-015) | Pedido do desenvolvedor: sistema "com a carinha da ECTAS" |
| 12/11/2026 | Exclusão só sem registros associados; trava de feriados por prazo de fechamento; Gerente Geral só Diretoria (vários); responsável só Gestor ativo; códigos `JA_EXISTE`/`EM_USO`; React Hook Form 7.92.0 + resolvers 7.0.6; componentes de lista, confirmação e avisos (ADR-016) | Regras do desenvolvedor (12/11/2026) e seção 5.3 |
| 12/11/2026 | Variáveis: tipo/acumulação/setor fixos com lançamentos ou metas; não inativa com meta ativa; responsável do Corporativo só Gestor ativo e opcional; códigos reservados; `renomearVariavel` pelos tokens no motor; testes dos pacotes em sequência (ADR-017) | Decisões do desenvolvedor (12/11/2026); RF-21; banco de teste compartilhado |
| 12/11/2026 | Meta salva inteira (mãe + submetas + objetivos + atribuições) com `versao`; departamental atribuída só ao responsável; responsável qualquer Gestor ativo; exclusão só sem valor lançado; leitura de metas por `podeVerMeta` (ADR-018) | Decisões do desenvolvedor (12/11/2026); RF-13; controle otimista (5.2) |
| 12/11/2026 | Testes da API sobem a aplicação numa porta e usam `cliente(app)` com agente keep-alive, nunca `request(app.getHttpServer())` (ADR-019) | Defeito do Node 24.15 no Windows derrubava o worker do Vitest |
| 12/11/2026 | Editor de metas: um `useForm` com `raiz` e `submetas`, números digitados convertidos com `Decimal` em `paraEntrada`, prévia com o motor no navegador, salvar com `mutateAsync` (ADR-020) | RF-17; mesmo motor na API e na web; remontagem do editor ao recarregar a versão |
| 12/11/2026 | Um ciclo ativo por vez (ativar exige o anterior encerrado); encerrar só ciclo ativo depois do prazo de dezembro e sem reabertura; lista do que bloqueia a ativação e do que só avisa; códigos `CICLO_INCONSISTENTE` e `STATUS_CICLO_INVALIDO`; encerramento pelo motor com `carregarCiclo`; testes da web com limite de 15 s (ADR-021) | Decisões do desenvolvedor (12/11/2026); RF-07, RF-16, RN-32 |
| 13/11/2026 | Pacote único gerado na máquina de desenvolvimento (`pnpm deploy` + `node-linker=hoisted`, `tar.exe`); Prisma CLI como dependência de produção para `migrate deploy`; API com `node --env-file` e serviço NSSM em LOCAL SERVICE; publicação por pasta de versão com volta automática; `.ps1` em UTF-8 com BOM (ADR-022) | Servidor sem pnpm/npm; links do pnpm não cabem em `.zip`; privilégios mínimos; PowerShell 5.1 |
| 13/11/2026 | Recálculo na transação de quem muda, por escopo, com `pg_advisory_xact_lock` por ciclo; notas por soma no banco; meta inativa sem resultado; gravação em lote com `jsonb_to_recordset`; Leitor sem as notas do gestor; Gestor vê só os próprios pontos numa corporativa (ADR-023) | Especificação 6.5; decisão do desenvolvedor (13/11/2026); aceite de < 1 s para 150 metas |
| 13/11/2026 | Lançamento: só SIM/NÃO (0/1) e casas da variável limitam o valor; Gestor só no ciclo ativo; Administrador em carga histórica fora de ciclo encerrado; status do mês por variável (reabertura por setor); lote tudo ou nada com o erro mais grave; histórico como auditoria dos lançamentos; `Relogio` injetável; esperas de 5 s nos testes da web (ADR-024) | Decisão do desenvolvedor (13/11/2026); RN-07, RN-34 a RN-40; 7.5 |
| 13/11/2026 | Tela de lançamentos com camada pura testada (`lerCampo`, `agrupar`, `previa` com o motor); mês na URL; GET de lançamentos com ciclo/mês opcionais e os 12 meses; `diasUteisRestantes` no motor; conflito resolvido campo a campo (ADR-025) | Especificação 9.2 e RF-24; o Gestor não lista ciclos |
| 13/11/2026 | Resultados do gestor com ciclo opcional (ativo, senão o encerrado mais recente) e lista de ciclos; rascunho só para Admin e Diretoria; memória de cálculo tipada em `@metas/tipos`; `GET /lancamentos/pendencias` para o Início; camada pura de exibição e `SituacaoMeta` compartilhado (ADR-026) | Decisões do desenvolvedor (13/11/2026); especificação 10.2, RF-28 e RF-38; o Gestor não lista ciclos |
| 13/11/2026 | Node 26.13.1 LTS (`engines` `>=26.13.1 <27`, `@types/node` 26.6.6) e pnpm 10.34.9 instalado pelo npm; `RELOGIO_FIXO` só em desenvolvimento; E2E com `@playwright/test` 1.64.1 no Edge, banco `metas_e2e_teste` próprio e `pnpm e2e` fora do `verify`; ARR sem porta no `X-Forwarded-For` (ADR-027) | Decisão do desenvolvedor depois da atualização automática do Node (13/11/2026); P21; seção 6 |
| 13/11/2026 | Serviço de jobs com pg-boss 12.38.0 (fila `singleton`, cron 00h05 em São Paulo, execução ao iniciar); rotina diária registra na auditoria (`fechamento_mes`, `reabertura`/`VENCIDA`, `rotina_diaria`) e recupera até 62 dias; schema `pgboss` pela migração com `USAGE, CREATE` só para o `metas_app` e `createSchema: false`; `Notificador` para a Fase 2; `metas-jobs` no NSSM com o mesmo `api.env`; `overrides` dos tipos do React 18 (ADR-028) | Decisões do desenvolvedor (13/11/2026); RN-34 a RN-36, especificação 9.3; privilégios mínimos |
