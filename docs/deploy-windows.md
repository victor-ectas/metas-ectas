# Instalação em produção (Windows Server)

Roteiro da primeira instalação do Sistema de Gestão de Metas no servidor interno e das atualizações seguintes (passo P16). Siga na ordem. Cada passo diz onde roda: **[dev]** na máquina de desenvolvimento, **[servidor]** no PowerShell do servidor, como Administrador.

## Como fica no servidor

```
celular / PC (rede interna)
        │ https://metas.<domínio interno>
        ▼
IIS, site "metas" ── arquivos estáticos da web (D:\metas\versoes\<versão>\web)
        │ /api/*  (URL Rewrite + ARR)
        ▼
Serviço "metas-api" (NSSM, conta LOCAL SERVICE) ── node 127.0.0.1:3000
        │
        ▼
PostgreSQL 17 (localhost:5432, banco "metas") ◄── Serviço "metas-jobs" (NSSM, LOCAL SERVICE)
                                                  rotina diária às 00h05
```

- A API só escuta em `127.0.0.1`: ninguém na rede fala com ela sem passar pelo IIS.
- Cada publicação vai para uma pasta própria em `D:\metas\versoes`. Voltar uma versão é apontar de novo para a pasta anterior.
- O serviço de jobs (`metas-jobs`, P22) não recebe requisições: às 00h05 registra na auditoria os meses que fecharam no dia anterior (com as pendências de cada gestor) e as reaberturas que venceram. A trava dos meses não depende dele: a API calcula o status na hora. Se ele ficar parado, recupera os dias perdidos quando voltar (até 62 dias). A fila dele fica no schema `pgboss` do mesmo banco, criado pelas migrações.

| Pasta                             | Conteúdo                                                                     | Quem lê                                                      |
| --------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `D:\metas\versoes\<versão>\api`   | API compilada com as dependências                                            | serviço                                                      |
| `D:\metas\versoes\<versão>\jobs`  | serviço de jobs compilado com as dependências                                | serviço                                                      |
| `D:\metas\versoes\<versão>\web`   | site estático e `web.config`                                                 | IIS                                                          |
| `D:\metas\versoes\<versão>\banco` | migrações                                                                    | `publicar.ps1`                                               |
| `D:\metas\config`                 | `api.env`, `migracao.env`, `pgpass.conf` (segredos)                          | só Administradores e SYSTEM; os serviços leem só o `api.env` |
| `D:\metas\logs`                   | `api.log`, `jobs.log` e os `-erros.log` (rotação a cada 10 MB), `backup.log` | Administradores                                              |
| `D:\metas\scripts`                | scripts da última versão publicada                                           | Administradores                                              |
| `D:\metas-dados\backup`           | backups diários (30 dias)                                                    | só Administradores e SYSTEM                                  |

Se o servidor não tiver o disco `D:`, use outro caminho curto: todos os scripts aceitam `-Base` e `-PastaBackup`/`-Destino`. Caminhos longos podem estourar o limite de 260 caracteres do Windows dentro de `node_modules`.

## 0. Antes de começar: o que pedir à TI

1. **Nome interno do site** (DNS), por exemplo `metas.ectas.local`, apontando para o servidor.
2. **Certificado HTTPS para esse nome**, emitido pela autoridade certificadora interna da empresa (se houver uma, como o AD CS), e já confiado pelos celulares e PCs corporativos.
   - Peça o certificado com o nome no campo SAN (Subject Alternative Name), chave privada exportável não é necessária, instalado em _Computador Local > Pessoal_ no servidor.
   - Anote a **impressão digital** (thumbprint).
   - Sem HTTPS confiável, o login Microsoft não funciona: o Entra ID só aceita `http` para `localhost`, e os navegadores dos celulares mostram aviso de site inseguro.
   - Se não houver autoridade interna, a alternativa é um certificado público (por exemplo, um curinga `*.ectas.com.br`) com um nome interno coberto por ele.
3. **Firewall**: liberar só a porta 443 (e a 80, que apenas redireciona) para a rede interna. As portas 3000 (API) e 5432 (PostgreSQL) **não** devem ser liberadas.
4. **Registro do aplicativo no Entra ID** (portal do Azure, _Registros de aplicativo_), o mesmo do P10:
   - Plataforma **SPA** com a URI de redirecionamento `https://<nome do site>/` (com a barra no fim).
   - _Expor uma API_: URI `api://metas` e o escopo `acesso`.
   - No manifesto: `"accessTokenAcceptedVersion": 2`.
   - Anote: **ID do diretório (tenant)** e **ID do aplicativo (cliente)**.

## 1. Preparar o servidor [servidor]

### 1.1 IIS

```powershell
Install-WindowsFeature Web-Server, Web-Static-Content, Web-Default-Doc, Web-Http-Errors, Web-Http-Logging, Web-Filtering, Web-Mgmt-Console
```

Depois instale, nesta ordem, os módulos da Microsoft (baixe do site oficial da IIS):

1. **URL Rewrite 2.1** (`rewrite_amd64_pt-BR.msi` ou `en-US`).
2. **Application Request Routing 3.0** (ARR).

O `instalar-servico.ps1` (passo 4) liga o proxy do ARR e recusa continuar se faltar algum dos dois.

### 1.2 Node.js 26.13.1

Baixe o instalador **node-v26.13.1-x64.msi** em <https://nodejs.org/dist/v26.13.1/> e confira o hash SHA-256 com o arquivo `SHASUMS256.txt` da mesma pasta:

```powershell
Get-FileHash .\node-v26.13.1-x64.msi -Algorithm SHA256
```

Instale com as opções padrão (vai para `C:\Program Files\nodejs`). Não precisa de pnpm nem de npm no servidor.

### 1.3 NSSM

Baixe o NSSM em <https://nssm.cc/download>. Use a versão **2.24-101** (pré-lançamento), que corrige o problema de serviços que não iniciam no Windows 10/Server 2016 em diante. Copie o `win64\nssm.exe` para `C:\Program Files\nssm\nssm.exe`.

### 1.4 PostgreSQL 17

O PostgreSQL 17 já roda neste servidor. Confira:

```powershell
& 'C:\Program Files\PostgreSQL\17\bin\psql.exe' -U postgres -c "SELECT version();"
```

No `postgresql.conf` (pasta `data` da instalação):

- `listen_addresses = 'localhost'`: o instalador costuma colocar `'*'`; a API e o backup só usam `localhost`. Se outro sistema já usa este PostgreSQL pela rede, mantenha como está e confira o `pg_hba.conf` abaixo.

No `pg_hba.conf`, as linhas de `localhost` devem usar `scram-sha-256`:

```
host    all    all    127.0.0.1/32    scram-sha-256
host    all    all    ::1/128         scram-sha-256
```

Reinicie o serviço do PostgreSQL se mudou algo.

### 1.5 Acesso ao Entra ID

A API baixa as chaves públicas do Entra ID para validar os tokens. Teste a saída para a internet:

```powershell
Invoke-RestMethod https://login.microsoftonline.com/common/discovery/v2.0/keys | Select-Object -ExpandProperty keys | Measure-Object
```

Tem que devolver uma contagem maior que zero.

## 2. Banco de dados e usuários [servidor]

Escolha duas senhas fortes, **sem** os caracteres `@ : / ? #` (elas vão em URLs): uma para `metas_owner` (dono do esquema, só migrações e backup) e outra para `metas_app` (a aplicação, com privilégios mínimos). Guarde-as no cofre de senhas da TI.

O script está no pacote (passo 3), em `servidor\sql\criar-banco.sql`. Rode uma vez:

```powershell
& 'C:\Program Files\PostgreSQL\17\bin\psql.exe' -U postgres -d postgres -v ON_ERROR_STOP=1 `
  -v senha_owner="SENHA_OWNER" -v senha_app="SENHA_APP" -f .\servidor\sql\criar-banco.sql
```

O que ele cria:

- os papéis `metas_owner` e `metas_app`;
- o banco `metas`, do `metas_owner`, com o esquema `public` fechado para os outros;
- privilégios padrão: tudo que as migrações criarem já nasce com `SELECT/INSERT/UPDATE/DELETE` para o `metas_app`, que não cria nem altera tabelas e não consegue desligar os triggers de histórico e auditoria.

## 3. Gerar o pacote [dev]

1. Garanta tudo commitado.
2. Copie `deploy\producao-web.env.example` para `deploy\producao-web.env` (fora do git) e preencha com os IDs do passo 0: `VITE_ENTRA_CLIENT_ID`, `VITE_ENTRA_TENANT_ID` e `VITE_API_SCOPE` (`api://metas/acesso`).
3. Com o banco de desenvolvimento no ar (`pnpm db:subir`), rode na raiz do repositório:

```powershell
powershell -ExecutionPolicy Bypass -File deploy\empacotar.ps1
```

O script roda o `pnpm verify`, compila, monta a API com as dependências de produção (sem links do pnpm), confere que o build da web não leva endereço de desenvolvimento nem o modo DEV, e gera `pacotes\metas-<data>-<commit>.zip` (cerca de 115 MB).

Copie o `.zip` para o servidor, por exemplo para `C:\temp`.

## 4. Instalação única [servidor]

Extraia só a pasta de scripts do pacote:

```powershell
New-Item -ItemType Directory -Force C:\temp\metas-instalar | Out-Null
tar -x -f C:\temp\metas-<versão>.zip -C C:\temp\metas-instalar servidor
cd C:\temp\metas-instalar\servidor
```

Rode a instalação (pode repetir sem problema):

```powershell
powershell -ExecutionPolicy Bypass -File .\instalar-servico.ps1 -Endereco metas.ectas.local -Certificado <impressão digital>
```

Ele:

- cria as pastas da tabela acima com as permissões (por SID, funciona em Windows em português ou inglês);
- liga o proxy do ARR (com 2 minutos de limite, para a importação de Excel do P24) e faz o ARR mandar o IP do cliente em `X-Forwarded-For` **sem a porta**, para o limite de taxa e a auditoria da API enxergarem o IP real;
- cria o pool `metas` (sem .NET) e o site `metas` com HTTPS no endereço e o certificado, e HTTP só para redirecionar;
- cria os serviços `metas-api` e `metas-jobs` no NSSM: conta **LOCAL SERVICE**, início automático atrasado, reinício em 5 s se cair, logs com rotação, `TZ=America/Sao_Paulo`. Os serviços só sobem na primeira publicação. O `metas-jobs` lê o mesmo `api.env` da API (usa só `NODE_ENV`, `DATABASE_URL` e `LOG_LEVEL`) e tem 35 s para terminar a rotina em andamento quando é parado.

Servidor instalado antes do P22? Rode o `instalar-servico.ps1` de novo antes de publicar: ele cria o `metas-jobs` e só ajusta o que já existe. O `publicar.ps1` recusa continuar sem o serviço.

Sem `-Certificado`, o site fica só em HTTP e o script avisa. Rode de novo com o certificado quando ele chegar.

## 5. Configuração [servidor]

Crie os três arquivos em `D:\metas\config` (o Bloco de Notas serve; salve em UTF-8):

**`api.env`** a partir de `servidor\api.env.example`:

```
NODE_ENV=production
PORT_API=3000
DATABASE_URL=postgresql://metas_app:SENHA_APP@localhost:5432/metas
WEB_ORIGIN=https://metas.ectas.local
ENTRA_TENANT_ID=<ID do diretório>
ENTRA_API_AUDIENCE=api://metas,<ID do aplicativo>
AUTH_DEV=false
LOG_LEVEL=info
LIMITE_ESCRITA_POR_MINUTO=120
```

- `WEB_ORIGIN` é o endereço exato do site, com `https://` e sem barra no fim (é o CORS).
- `ENTRA_API_AUDIENCE` leva o URI e o ID do aplicativo, separados por vírgula: os tokens v2 trazem o ID em `aud`.
- A API se recusa a iniciar se faltar algo ou se `AUTH_DEV=true`, e o log de erros diz o quê.

**`migracao.env`** (só o `publicar.ps1` lê, nunca o serviço):

```
DATABASE_URL_MIGRACAO=postgresql://metas_owner:SENHA_OWNER@localhost:5432/metas
```

**`pgpass.conf`** (backup; formato do PostgreSQL, uma linha):

```
localhost:5432:metas:metas_owner:SENHA_OWNER
```

As permissões da pasta já vêm do passo 4. A cada publicação, o serviço ganha leitura **só** do `api.env`.

## 6. Publicar [servidor]

```powershell
powershell -ExecutionPolicy Bypass -File C:\temp\metas-instalar\servidor\publicar.ps1 -Pacote C:\temp\metas-<versão>.zip
```

Nas próximas vezes, use o script já instalado: `D:\metas\scripts\publicar.ps1`.

O que acontece:

1. extrai o pacote em `D:\metas\versoes\<versão>`;
2. faz um backup do banco (pule com `-PularBackup` só na primeiríssima publicação, com o banco vazio, se quiser);
3. para os serviços da API e dos jobs e aplica as migrações pendentes (`prisma migrate deploy`, que só acrescenta; nunca apaga);
4. aponta os serviços e o site para a versão nova e sobe a API;
5. confere `GET /api/v1/saude` por até 60 s. Se a API não responder, **volta sozinho** para a versão anterior. Com a API no ar, sobe o serviço de jobs;
6. atualiza `D:\metas\scripts` e guarda as 5 versões mais recentes.

Confira no navegador do próprio servidor: `https://metas.ectas.local/api/v1/saude` deve mostrar `"status":"ok"`.

## 7. Primeiro Administrador [servidor]

O seed de desenvolvimento se recusa a rodar em produção, e quem entra pela primeira vez vira Leitor inativo. Por isso, o primeiro Administrador é pré-cadastrado pelo e-mail corporativo:

```powershell
& 'C:\Program Files\PostgreSQL\17\bin\psql.exe' -U metas_owner -d metas -v ON_ERROR_STOP=1 `
  -v email="nome.sobrenome@ectas.com.br" -v nome="Nome Sobrenome" -f D:\metas\scripts\sql\criar-admin.sql
```

No primeiro login com a conta Microsoft desse e-mail, a API liga a conta ao cadastro. A criação fica na auditoria (`CRIAR_ADMIN_INSTALACAO`). Os demais usuários entram sozinhos e são ativados pelo Administrador em **Cadastros > Usuários**.

## 8. Backup diário e teste de restauração [servidor]

Agende o backup diário (02:00, conta SYSTEM, retenção de 30 dias):

```powershell
powershell -ExecutionPolicy Bypass -File D:\metas\scripts\backup.ps1 -Agendar
```

Rode um backup agora e teste a restauração (pede a senha do `postgres`; restaura num banco temporário, compara as contagens e apaga o temporário):

```powershell
powershell -ExecutionPolicy Bypass -File D:\metas\scripts\backup.ps1 -Motivo instalacao
powershell -ExecutionPolicy Bypass -File D:\metas\scripts\testar-restauracao.ps1
```

- Repita o teste de restauração todo mês e registre o resultado.
- Os backups ficam no próprio servidor. **Peça à TI para copiar `D:\metas-dados\backup` para outro local** (outro servidor ou o backup corporativo); um backup que morre junto com o disco não protege nada.
- O histórico das execuções fica em `D:\metas\logs\backup.log`.

## 9. Conferência final (aceite do P16)

- [ ] `https://<endereço>/api/v1/saude` responde `"status":"ok"`.
- [ ] Pelo celular, na rede interna (Wi-Fi corporativo), o endereço abre com o cadeado, sem aviso de certificado.
- [ ] O login Microsoft funciona e o Administrador cai no Início com o perfil Administrador.
- [ ] Em **Cadastros**, o Administrador cria o ciclo 2027 e começa a cadastrar setores, responsáveis, variáveis e metas.
- [ ] Os serviços `metas-api` e `metas-jobs` estão _Em execução_ e com início automático; reiniciar o servidor traz tudo de volta sozinho.
- [ ] `D:\metas\logs\jobs.log` mostra "Serviço de jobs no ar" e "Rotina diária concluída" (a primeira execução registra o dia anterior).
- [ ] A tarefa "Metas - backup diario" existe, e o teste de restauração passou.
- [ ] De outra máquina da rede, `http://<servidor>:3000` **não** responde (a API só escuta localmente).

## 10. Atualizações seguintes

1. **[dev]** `deploy\empacotar.ps1` gera o pacote novo.
2. **[servidor]** `D:\metas\scripts\publicar.ps1 -Pacote <zip>`.

Para voltar à versão anterior (a versão no ar fica em `D:\metas\atual.txt`):

```powershell
powershell -ExecutionPolicy Bypass -File D:\metas\scripts\voltar-versao.ps1 -Versao <versão anterior>
```

O banco não volta junto. As migrações do sistema só acrescentam, então a versão anterior costuma funcionar. Se a versão nova mudou o significado de algum dado, restaure o backup feito pelo `publicar.ps1` (`metas-<data>-antes-de-<versão>.dump`) com `pg_restore`, depois de parar o serviço.

## 11. Problemas comuns

| Sintoma                                                    | Onde olhar                          | Causa provável                                                                                                                             |
| ---------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `publicar.ps1` diz que a API não respondeu                 | `D:\metas\logs\api-erros.log`       | Variável faltando ou errada no `api.env` (a API lista quais)                                                                               |
| Erro 502.3 no navegador                                    | Serviço `metas-api`                 | Serviço parado; ARR não alcança a porta 3000                                                                                               |
| Erro 404 em `/api/...`                                     | Gerenciador do IIS > servidor > ARR | Proxy do ARR desligado (rode `instalar-servico.ps1` de novo)                                                                               |
| `jobs-erros.log` com "permission denied for schema pgboss" | Migrações                           | Migração `schema_pgboss` não aplicada, ou o usuário da aplicação não se chama `metas_app` (conceda `USAGE, CREATE ON SCHEMA pgboss` a ele) |
| `publicar.ps1` diz que o serviço `metas-jobs` não existe   | Serviços do Windows                 | Servidor instalado antes do P22: rode `instalar-servico.ps1` de novo                                                                       |
| Login volta com erro de redirecionamento                   | Registro do aplicativo              | URI de redirecionamento SPA diferente do endereço (falta a barra no fim, `http` em vez de `https`)                                         |
| `NAO_AUTENTICADO` logo depois do login                     | `api.env`                           | `ENTRA_TENANT_ID` ou `ENTRA_API_AUDIENCE` não batem com o registro do aplicativo                                                           |
| Erro de CORS no console do navegador                       | `api.env`                           | `WEB_ORIGIN` diferente do endereço digitado                                                                                                |
| Backup falha com "password authentication failed"          | `D:\metas\config\pgpass.conf`       | Senha ou porta erradas no arquivo                                                                                                          |
