# Revisão de segurança — Entrega 1a

- **Data:** 13/11/2026
- **Passo:** P21
- **Base:** seção 6 do [CLAUDE.md](../CLAUDE.md), item a item, conferida no código e nos testes do commit da Entrega 1a.
- **Repetir:** antes de cada entrega (P28 e Fase 2) e sempre que entrar uma rota, um perfil ou uma dependência nova.

Legenda: **Ok** = implementado e coberto por teste; **Ok (servidor)** = depende da configuração do servidor, conferir na instalação (P16); **Fase 2** = ainda não se aplica.

## Resumo

| #   | Item da seção 6                                         | Situação                                          |
| --- | ------------------------------------------------------- | ------------------------------------------------- |
| 1   | Autenticação (JWT do Entra ID)                          | Ok                                                |
| 2   | Usuário pelo `oid`, primeiro acesso como Leitor inativo | Ok                                                |
| 3   | Modo DEV com trava de produção                          | Ok                                                |
| 4   | Autorização centralizada no `PoliticasService`          | Ok                                                |
| 5   | Cabeçalhos (helmet, CSP, HSTS) e CORS                   | Ok; CSP e HSTS completos no IIS (servidor)        |
| 6   | Limite de taxa nas escritas                             | Ok; **corrigido nesta revisão** o IP vindo do ARR |
| 7   | Uploads                                                 | Fase 2 (e P24, importação)                        |
| 8   | SQL só parametrizado                                    | Ok                                                |
| 9   | Logs sem token nem e-mail em massa                      | Ok                                                |
| 10  | Auditoria somente inclusão                              | Ok; reaberturas entram no P23                     |
| 11  | `pnpm audit`                                            | Ok; 1 moderada só de desenvolvimento              |

Nenhum item bloqueia a Entrega 1a. Os três pontos que ficam para a instalação estão em [Pendências](#pendências).

## 1. Autenticação

- [validador-token.ts](../apps/api/src/auth/validador-token.ts) usa `jose` com o JWKS do tenant e confere:
  - assinatura, só `RS256`;
  - emissor `https://login.microsoftonline.com/{TENANT_ID}/v2.0`;
  - audiência (`ENTRA_API_AUDIENCE`);
  - expiração, com 60 s de folga para diferença de relógio.
- Exige as claims `oid` e `scp`. Assim, token só de aplicativo e ID token não passam.
- Falha ao buscar as chaves da Microsoft vira erro interno, e não "login inválido": um problema de rede não se disfarça de token ruim.
- Testes em [auth.test.ts](../apps/api/test/auth.test.ts):
  - token ausente, inválido, assinado com outra chave e expirado;
  - token sem `exp`, de outro tenant, com emissor v1 e com outra audiência;
  - token sem `scp` e sem `oid`.

## 2. Usuário

- O `oid` identifica o usuário. No primeiro acesso:
  - quem tem pré-cadastro pelo e-mail fica ligado a ele;
  - quem não tem é criado como **Leitor inativo**, com auditoria ([acesso.service.ts](../apps/api/src/auth/acesso.service.ts)).
- Um e-mail que já está ligado a outro `oid` é recusado e só o Administrador resolve.
- O perfil fica no banco, e só o Administrador altera. O inativo só acessa `GET /me`.

## 3. Modo DEV

- Com `AUTH_DEV=true` fora de `NODE_ENV=development`, a API não inicia ([config.ts](../apps/api/src/config/config.ts)). Testado em produção e em teste.
- O cabeçalho `X-Usuario-Dev` só é lido com `AUTH_DEV=true`, e só nesse caso entra no CORS.
- Na web, o modo DEV não entra no build de produção. Isso foi conferido no `dist` no P10.
- **Novo no P21:** `RELOGIO_FIXO`, o relógio fixo dos testes ponta a ponta, tem a mesma trava. Fora de desenvolvimento, a API não inicia com ele.

## 4. Autorização

- O `AuthGuard` é global: toda rota exige login, menos as marcadas com `@Publica()` (só a saúde).
- `@Perfis(...)` é decidido pelo `PoliticasService`.
- As regras finas ficam nas funções puras de [politicas.service.ts](../apps/api/src/politicas/politicas.service.ts), chamadas pelos serviços:
  - `podeVerMeta`;
  - `podeLancar`;
  - `podeFazerCargaHistorica`;
  - `veResultadosEmRascunho`;
  - e as demais.
- Procurei comparações de perfil fora das políticas. As que existem são validação de cadastro (por exemplo, "responsável precisa ser Gestor ativo"), não decisão de acesso.
- As regras são testadas em [politicas.test.ts](../apps/api/test/politicas.test.ts), e cada rota tem teste de integração por perfil.

## 5. Cabeçalhos e CORS

- **API** ([configurar-app.ts](../apps/api/src/configurar-app.ts)):
  - `helmet` em todas as respostas, com CSP completo em produção (fora dela, o CSP é desligado só por causa do Swagger);
  - `x-powered-by` desligado;
  - CORS só para `WEB_ORIGIN`, com métodos e cabeçalhos listados.
- **Site** ([web.config](../deploy/servidor/web.config)): o IIS envia o CSP da web (só o próprio site e o login da Microsoft) e o HSTS de 1 ano. O CSP foi conferido no Edge sem violações no P16.
- Testes em [erros-e-seguranca.test.ts](../apps/api/test/erros-e-seguranca.test.ts).

## 6. Limite de taxa

- `LimiteEscritaGuard`: escritas (POST, PUT, PATCH, DELETE) limitadas por IP, com `LIMITE_ESCRITA_POR_MINUTO`, padrão 120. A resposta é `429 MUITAS_REQUISICOES`, e há teste.
- A importação (P24) passa pelo mesmo guard, por ser POST. Se precisar de limite próprio, ele entra no P24.
- **Corrigido nesta revisão:**
  - **O problema:** a API confia só no proxy local (`trust proxy: loopback`) e lê o IP do cliente em `X-Forwarded-For`. Por padrão, o ARR do IIS manda esse cabeçalho **com a porta** (`10.0.0.5:51234`). Assim cada conexão contaria como um cliente diferente, e o limite e o IP da auditoria perderiam o sentido.
  - **A correção:** o [instalar-servico.ps1](../deploy/servidor/instalar-servico.ps1) agora configura `includePortInXForwardedFor=False`. O roteiro de instalação foi atualizado.

## 7. Uploads

Ainda não há upload. A importação de Excel (P24) e as evidências (P31) vão seguir a regra quando entrarem:

- tipo checado pelo conteúdo;
- limite de 10 MB;
- nome aleatório;
- pasta fora do site;
- download só pela API.

## 8. SQL

- Nenhum `$queryRawUnsafe` ou `$executeRawUnsafe` no código da API nem do jobs. Todo SQL direto usa o template parametrizado do Prisma (por exemplo, a gravação em lote dos resultados com `jsonb_to_recordset`).
- O único `$executeRawUnsafe` do repositório está no preparo do banco dos testes ponta a ponta ([preparar-banco.ts](../apps/web/e2e/preparar-banco.ts)). Ele cria um banco com nome constante, e `CREATE DATABASE` não aceita parâmetro.

## 9. Logs

- O log HTTP grava só o id da requisição, o método, a URL e o status. Não grava cabeçalhos (o token fica de fora) nem corpo.
- Os logs de negócio registram o `usuarioId`, nunca o e-mail.
- Erros inesperados vão para o log com o `requestId`. O usuário recebe só `ERRO_INTERNO`, sem stack nem SQL. Há teste.

## 10. Auditoria

- A tabela `auditoria` registra antes e depois na mesma transação da mudança, para:
  - usuário (perfil, ativo, setores do Leitor e primeiro acesso);
  - setor, feriado e ciclo (criar, ativar e encerrar);
  - responsável por setor;
  - variável (inclusive a renomeação que reescreve fórmulas);
  - meta (fórmula, objetivos, atribuições e pesos).
- Os lançamentos ficam em `lancamento_historico`, com valor anterior, valor novo, origem, usuário e a reabertura, quando houver.
- As duas tabelas são somente inclusão: triggers bloqueiam UPDATE, DELETE e TRUNCATE. Há testes no `@metas/prisma`.
- As reaberturas entram no P23.

## 11. Dependências

`pnpm audit` em 13/11/2026: **1 moderada**, a `minimatch <11.0.1`, que vem do ESLint e só é usada no desenvolvimento. É uma negação de serviço com padrões glob maliciosos, que não se aplica aqui. É a mesma desde o P01. Nada de produção afetado.

## Pendências

Estes pontos ficam para a instalação no servidor (P16) e devem ser conferidos lá:

1. **Conferir o HTTPS e o HSTS** no endereço final, com o certificado da empresa.
2. **Conferir o IP real:** depois da instalação, ver no log da API ou na auditoria se o IP do cliente aparece sem porta e não como `127.0.0.1`.
3. **Login real no Entra ID** (pendência do P10): conferir com um token de verdade o emissor v2, a audiência (`ENTRA_API_AUDIENCE`) e o `accessTokenAcceptedVersion: 2` no manifesto do aplicativo.
