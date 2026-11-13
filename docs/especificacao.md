# Sistema de Gestão de Metas — Especificação Técnica

Nov 11, 2026 · @Victor

## 1. Visão geral

O sistema substitui as planilhas Excel de metas (uma por gestor, com macros, LAMBDAs e Power Query) por uma aplicação web única. Nela, o Administrador cadastra metas, variáveis e fórmulas; os gestores lançam as variáveis mês a mês; o sistema calcula o resultado mensal, o acumulado do ano, o atendimento e a pontuação de cada gestor. A **Entrega 1a** entra em produção em **22/01/2027**, para os gestores lançarem janeiro; a **Entrega 1b**, em **12/02/2027**, antes do primeiro fechamento real (19/02/2027). Os dados de 2026 entram como carga histórica na 1b. Nome sugerido: **Prumo ECTAS** (a confirmar).

### Problemas que motivam o sistema

A análise das planilhas de Leonardo, Julia e Evandro encontrou erros estruturais que o sistema precisa eliminar por desenho, não por disciplina:

- **Acumulação errada de variáveis.** Variáveis que são "fotografia" do mês (total de colaboradores, qtde de processos críticos) são somadas no ano. No RH da Julia, o checklist chegou a 682%.
- **Pontuação que ignora o operador.** A fórmula de pontuação testa sempre resultado ≥ objetivo, inclusive nas metas ≤. Metas de prazo cumpridas recebem zero.
- **Pontuação acima do peso.** Não há teto; "Tempo de fechamento de vagas" gerou 5,72 pontos num peso de 0,15.
- **Submetas somadas pelo valor bruto.** O Engajamento faz média de grandezas diferentes (90% de presença, 3% de turnover, nota 2,98).
- **Meses vazios contados como zero**, puxando médias para baixo.
- **Fórmulas, operadores e objetivos inconsistentes** sem nenhuma validação (ver seção 14).
- **Sem histórico, sem multiusuário, só no Excel desktop.**

### Objetivo

Uma única fonte de verdade para metas: cadastro flexível (fórmula livre por meta), lançamento mensal simples em qualquer dispositivo, cálculo correto e auditável, trava de meses fechados e base pronta para o dashboard.

### Escopo por fase

| Fase | Entrega | Prazo |
| --- | --- | --- |
| 1a — Núcleo para lançar | Login Microsoft, cadastros (ciclo, setores, usuários, calendário), metas e submetas, variáveis, motor de fórmulas, lançamento mensal, cálculo mensal e acumulado, pontuação e nota, trava por 15 dias úteis, histórico, telas responsivas | 22/01/2027 |
| 1b — Completa a Fase 1 | Importação Excel, carga histórica (dados de 2026), reabertura, catálogo de modelos, visão geral da Diretoria, exportação, schema bi | 12/02/2027, antes do 1º fechamento real |
| 2 — Governança e gestão | Pedido de correção com aprovação do Gerente Geral, lembretes por e-mail, evidências (anexos e comentários), avaliação de comportamentos, cópia de ciclo, referência ao ano anterior, dashboard nativo | Março a maio/2027 |
| 3 — Integrações | Integração com ERP e fontes externas (substituindo a importação Excel onde fizer sentido), notificações no Teams | A definir |

### Fora de escopo

- Remuneração variável, PPR ou bônus (a nota não afeta pagamento).
- Autoavaliação do funcionário na avaliação de comportamentos.
- Acesso pela internet: o sistema roda só na rede interna.
- Aprovação de metas: o Administrador cadastra e a meta vale imediatamente.

## 2. Glossário

| Termo | Definição |
| --- | --- |
| **Ciclo** | Ano de metas, sempre de janeiro a dezembro (ex.: Ciclo 2027). Tudo (metas, pesos, objetivos, lançamentos) pertence a um ciclo. |
| **Gestor** | Usuário responsável por metas e pelo lançamento das suas variáveis. Hoje são 7. |
| **Setor** | Unidade organizacional (RH, Fiscal, Qualidade…). Hoje são 17, mais o **Corporativo**. Cada setor tem um gestor responsável no ciclo. |
| **Modelo de meta** | Item do catálogo: nome, métrica, variáveis, fórmula, unidade, regras de acumulação e operador. Não tem peso nem objetivo. Ex.: "Check lists entregáveis". |
| **Meta** | Instância de um modelo (ou criada do zero) num ciclo, ligada a um setor e a um gestor, com peso, objetivo, período e regra de pontuação. |
| **Meta corporativa** | Meta do setor Corporativo. Tem um único conjunto de lançamentos, feito pelo gestor responsável, e pode ser **atribuída** a vários gestores, cada um com seu peso. |
| **Submeta** | Meta filha de uma meta-mãe (só 2 níveis). Tem peso **dentro da mãe**; os pesos das filhas somam 100%. |
| **Variável** | Dado bruto lançado por mês (ex.: Presenças, Eventos). Pertence a um setor e pode alimentar várias metas. |
| **Lançamento** | Valor de uma variável num mês de um ciclo. Pode estar vazio (não é zero). |
| **Acumulação da variável** | Como a variável vira um número do período: soma, média, último valor ou máximo. |
| **Modo de apuração da meta** | Como a meta chega ao resultado do período: aplicar a fórmula sobre as variáveis acumuladas, ou somar / tirar média / pegar máximo / pegar último dos resultados mensais. |
| **Período da meta** | Meses que contam para a nota (ex.: jan–mai). Lançamentos fora do período ficam como histórico. |
| **Objetivo** | Alvo da meta. Pode variar por mês; a nota do ano usa o objetivo do último mês do período. |
| **Atendimento** | Quanto do objetivo foi cumprido, de 0% a 100% (teto). |
| **Pontuação** | Peso × atendimento (proporcional) ou peso × (atendimento = 100% ? 1 : 0) (tudo ou nada). |
| **Bloco** | Agrupamento da nota do gestor: **Corporativo** (50%) e **Departamental** (50%). Sem metas corporativas, o Departamental vale 100%. |
| **Nota final** | Soma das pontuações do gestor no ciclo, de 0 a 100. |
| **Janela de lançamento** | Do 1º dia do mês de competência até o 15º dia útil do mês seguinte (calendário de Joinville). |
| **Fechamento** | Fim da janela: o mês trava para os gestores. |
| **Correção** | Pedido do gestor para mudar um valor de mês fechado; exige aprovação do Gerente Geral (Fase 2). |
| **Reabertura** | Ação do Administrador que reabre um mês fechado por um prazo, com motivo registrado. |
| **Carga histórica** | Modo do Administrador para lançar ou importar meses passados ignorando a trava. |

## 3. Perfis e permissões

São quatro perfis. Um usuário tem um perfil; o **Gerente Geral** é um usuário com perfil Diretoria marcado como aprovador de correções.

| Ação | Administrador | Diretoria | Gestor | Leitor |
| --- | --- | --- | --- | --- |
| Cadastrar ciclos, setores, usuários, calendário | Sim | Não | Não | Não |
| Cadastrar modelos, metas, variáveis, fórmulas, pesos | Sim | Não | Não | Não |
| Ver metas e resultados | Todos | Todos | Só as próprias e as atribuídas a ele | Os setores liberados a ele |
| Lançar variáveis em mês aberto | Não (só em carga histórica) | Não | Só dos setores e metas corporativas pelos quais responde | Não |
| Importar Excel | Sim, como carga histórica, em qualquer mês | Não | Sim, só nas próprias variáveis e em meses abertos (RN-41) | Não |
| Carga histórica (lançar ignorando a trava) | Sim | Não | Não | Não |
| Anexar evidência e comentar (Fase 2) | Sim | Sim (comentar) | Nas próprias | Não |
| Pedir correção em mês fechado (Fase 2) | Não | Não | Sim | Não |
| Aprovar correção (Fase 2) | Não | Só o Gerente Geral | Não | Não |
| Reabrir mês | Sim, com motivo e autorizador | Não | Não | Não |
| Avaliar comportamentos (Fase 2) | Não | Sim, dos seus subordinados | Sim, dos seus funcionários | Não |
| Ver histórico de alterações | Todos | Todos | Das próprias metas | Não |

**Como a Diretoria aprova.** Não há aprovação de metas. A Diretoria aprova apenas **pedidos de correção** em meses fechados, e quem aprova é o Gerente Geral. A reabertura de mês é combinada fora do sistema, mas o sistema registra o motivo e quem autorizou.

**Regra de responsabilidade.** Cada meta tem exatamente **um** gestor responsável e cada variável é lançada pelo gestor responsável pelo setor dela. Ninguém lança no lugar de outro, nem como substituto.

## 4. Requisitos funcionais

São 52 requisitos em 10 módulos; 39 são da Fase 1. A coluna Fase indica quando cada um entra.

### 4.1 Acesso e cadastros básicos

| ID | Requisito | Fase |
| --- | --- | --- |
| RF-01 | Login com conta Microsoft da empresa (Entra ID / OpenID Connect). Sem senha local. | 1 |
| RF-02 | Primeiro acesso cria o usuário como Leitor inativo; o Administrador define perfil e ativa. | 1 |
| RF-03 | CRUD de usuários: nome, e-mail, perfil, ativo, flag "Gerente Geral", superior imediato. | 1 |
| RF-04 | CRUD de setores, incluindo o setor especial Corporativo (único, não excluível). | 1 |
| RF-05 | Por ciclo, definir o gestor responsável de cada setor. | 1 |
| RF-06 | Calendário de feriados mantido pelo Administrador (data, descrição, tipo: nacional, estadual, municipal, ponto facultativo da empresa). Origem: Joinville/SC. | 1 |
| RF-07 | CRUD de ciclos (ano). Estados: Rascunho → Ativo → Encerrado. Só um ciclo Ativo por vez para lançamento corrente; ciclos anteriores aceitam carga histórica. | 1 |

### 4.2 Catálogo de modelos

| ID | Requisito | Fase |
| --- | --- | --- |
| RF-08 | CRUD de modelos de meta: nome, métrica (descrição), unidade do resultado, variáveis-modelo, fórmula, modo de apuração, operador sugerido. | 1 |
| RF-09 | Aplicar um modelo a vários setores e gestores de uma vez, cada um com peso, objetivo e período próprios. | 1 |
| RF-10 | Alterar o modelo não altera metas já criadas (cópia no momento da aplicação). O sistema mostra quais metas vieram de cada modelo. | 1 |

### 4.3 Metas e submetas

| ID | Requisito | Fase |
| --- | --- | --- |
| RF-11 | Cadastrar meta: ciclo, setor, gestor responsável, bloco (Corporativo/Departamental, derivado do setor), indicador, métrica, unidade, fórmula, modo de apuração, operador, objetivo, tolerância (faixa), período (mês inicial e final), regra de pontuação, peso. | 1 |
| RF-12 | Objetivo único ou por mês (tabela de 12 valores dentro do período). | 1 |
| RF-13 | Submetas (1 nível abaixo da mãe), cada uma com peso dentro da mãe. Bloquear salvar se os pesos das filhas não somarem 100,00%. | 1 |
| RF-14 | A meta-mãe pode ter variáveis e fórmula próprias, além das filhas (ver RN-30). | 1 |
| RF-15 | Meta corporativa: um cadastro, lançado pelo responsável, atribuído a N gestores, cada um com peso próprio. | 1 |
| RF-16 | Validar pesos por gestor: Corporativo soma 50% e Departamental soma 50%; sem corporativas, Departamental soma 100%. Mostrar alerta até fechar a conta; impedir ativar o ciclo com pesos inconsistentes. | 1 |
| RF-17 | Prévia da meta: ao editar, mostrar a frase-resumo ("Bate quando…") e testar a fórmula com valores de exemplo. | 1 |
| RF-18 | Inativar meta sem apagar histórico. Excluir só se não tiver lançamentos. | 1 |

### 4.4 Variáveis

| ID | Requisito | Fase |
| --- | --- | --- |
| RF-19 | Cadastrar variável: nome, código (usado na fórmula), setor dono, tipo (número, %, R$, dias, horas, SIM/NÃO), regra de acumulação (soma, média, último, máximo), origem (digitada ou importada), casas decimais de entrada. | 1 |
| RF-20 | Uma variável pode ser usada por várias metas (compartilhada). Um lançamento alimenta todas. | 1 |
| RF-21 | Ao renomear o código de uma variável, atualizar as fórmulas que a usam. | 1 |
| RF-22 | Referência ao ano anterior: a fórmula pode usar o valor da mesma variável no ciclo anterior (ANTERIOR(VAR)). | 2 |
| RF-23 | Variável calculada a partir de outra fonte do sistema (resultado de outra meta, média da avaliação de comportamentos). | 2 |

### 4.5 Lançamentos

| ID | Requisito | Fase |
| --- | --- | --- |
| RF-24 | Tela de lançamento por mês: lista as variáveis que o gestor deve preencher, agrupadas por meta, com o resultado do mês e o acumulado recalculando enquanto digita. | 1 |
| RF-25 | Variável compartilhada aparece uma vez só na tela, com a lista de metas que alimenta. | 1 |
| RF-26 | Salvar em lote; cada valor alterado gera registro no histórico (quem, quando, antes, depois, origem). | 1 |
| RF-27 | Campo vazio ≠ zero. Apagar um valor volta para vazio. | 1 |
| RF-28 | Indicador de pendências: quantas variáveis faltam no mês e quantos dias úteis restam. | 1 |
| RF-29 | Lançamentos fora do período da meta são aceitos e marcados como "histórico" (não contam na nota). | 1 |
| RF-30 | Comentário por lançamento e anexos de evidência (até 10 MB por arquivo; PDF, imagem, Excel, Word). | 2 |

### 4.6 Fechamento, reabertura e correções

| ID | Requisito | Fase |
| --- | --- | --- |
| RF-31 | Calcular automaticamente a data de fechamento de cada mês (15º dia útil do mês seguinte, calendário da empresa). | 1 |
| RF-32 | Após o fechamento, o mês fica só leitura para gestores. Meses futuros (depois do mês corrente) não aceitam lançamento. | 1 |
| RF-33 | Reabertura pelo Administrador: escopo (ciclo + mês + setor ou gestor, ou todos), prazo final, motivo e autorizador (texto). Registrada no histórico. | 1 |
| RF-34 | Carga histórica pelo Administrador: lançar e importar valores em qualquer mês, ignorando a trava, com marcação de origem "carga histórica". | 1 |
| RF-35 | Pedido de correção: o gestor informa variável, mês, valor novo e justificativa; o Gerente Geral aprova ou recusa (com motivo). Aprovado: valor aplicado e anterior preservado no histórico. | 2 |

### 4.7 Cálculo e resultados

| ID | Requisito | Fase |
| --- | --- | --- |
| RF-36 | Calcular, para cada meta: resultado de cada mês, resultado acumulado do período, atendimento, pontuação e situação (batida, abaixo, fora da faixa, sem dados). | 1 |
| RF-37 | Calcular a nota por bloco e a nota final do gestor. | 1 |
| RF-38 | Mostrar a "memória de cálculo" de cada meta: valores acumulados, fórmula aplicada, objetivo usado, atendimento e pontuação. | 1 |
| RF-39 | Recalcular automaticamente ao salvar lançamento, alterar meta ou aprovar correção. | 1 |

### 4.8 Importação e exportação

| ID | Requisito | Fase |
| --- | --- | --- |
| RF-40 | Baixar modelo Excel de importação (ciclo, mês, código do setor, código da variável, valor). | 1 |
| RF-41 | Importar Excel com pré-validação (linhas válidas, erros por linha, valores que serão sobrescritos) e confirmação antes de gravar. | 1 |
| RF-42 | Exportar para Excel: metas de um gestor/setor com resultados mensais e nota. | 1 |

### 4.9 Notificações e ciclo

| ID | Requisito | Fase |
| --- | --- | --- |
| RF-43 | E-mail ao gestor a 5 e a 2 dias úteis do fechamento, listando as variáveis pendentes. | 2 |
| RF-44 | E-mail à Diretoria no dia seguinte ao fechamento: quem deixou pendências. | 2 |
| RF-45 | E-mail ao Gerente Geral quando houver pedido de correção, e ao gestor com a decisão. | 2 |
| RF-46 | Copiar ciclo: criar o ciclo N+1 como rascunho com metas, variáveis, pesos e objetivos do ciclo N, sem lançamentos. | 2 |

### 4.10 Avaliação de comportamentos e dashboard

| ID | Requisito | Fase |
| --- | --- | --- |
| RF-47 | Cadastro dos 32 comportamentos em 8 competências (texto editável por ciclo). | 2 |
| RF-48 | Cadastro de funcionários (sem login): nome, setor, gestor avaliador. | 2 |
| RF-49 | Avaliação pelo gestor em 3 momentos (início, meio e fim do ano), nota de 1 a 5 por comportamento e comentário por competência; resultado = média por competência e média geral. | 2 |
| RF-50 | Gestores também são avaliados pelo superior; a média que o gestor recebe alimenta a meta "Modelo de liderança" via RF-23. | 2 |
| RF-51 | Base analítica (views SQL) pronta para Power BI Desktop e para o dashboard nativo. | 1 |
| RF-52 | Dashboard nativo no sistema, conforme o layout que será enviado. | 2 |

## 5. Regras de negócio

As regras abaixo são a referência para implementação e testes. Onde uma regra veio de decisão do negócio nesta especificação, ela está escrita como fato.

### 5.1 Estrutura e pesos

- **RN-01** O ciclo vai sempre de janeiro a dezembro. Toda meta, variável, peso, objetivo e lançamento pertence a um ciclo.
- **RN-02** O bloco da meta é derivado do setor: setor Corporativo → bloco Corporativo; qualquer outro setor → bloco Departamental.
- **RN-03** Por gestor e ciclo: pesos do bloco Corporativo somam 50 pontos e do Departamental somam 50 pontos (total 100). Gestor sem metas corporativas: o Departamental soma 100. Os pesos departamentais somam o total do bloco **juntos**, não por setor (ex.: Eng. 20 + Qualidade 15 + Monitoramento 15 = 50).
- **RN-04** Só metas-mãe e metas sem filhas têm peso no bloco. Submetas têm apenas peso interno, e os pesos internos das irmãs somam 100,00%.
- **RN-05** Meta corporativa tem um único conjunto de lançamentos e um único resultado. Ela é atribuída a N gestores; cada atribuição tem peso próprio. Quem lança é o gestor responsável pela meta corporativa.
- **RN-06** Toda meta tem exatamente um gestor responsável. Não existe substituto nem delegação.

### 5.2 Variáveis e lançamentos

- **RN-07** Toda variável pertence a um setor e é lançada pelo gestor responsável por esse setor no ciclo. Variáveis do setor Corporativo têm um responsável definido na própria variável.
- **RN-08** Vazio é diferente de zero. Vazio é ignorado em todas as acumulações; zero conta.
- **RN-09** Cada variável tem uma regra de acumulação: **soma** (fluxo do mês: presenças, horas, NFs), **média** dos meses com valor (prazos médios), **último** valor do período (fotografia: total de colaboradores, processos críticos, % de implantação acumulado) ou **máximo**.
- **RN-10** SIM/NÃO vale 1/0 nas fórmulas.
- **RN-11** Percentuais são digitados de 0 a 100 na tela e guardados como fração (25 → 0,25).
- **RN-12** Uma variável compartilhada tem um lançamento por mês, usado por todas as metas que a referenciam.

### 5.3 Período e objetivo

- **RN-13** Cada meta tem período (mês inicial e final dentro do ciclo). Só os meses do período entram no acumulado, no atendimento e na nota.
- **RN-14** Lançamentos fora do período são aceitos e exibidos como histórico; não alteram a nota. Exemplo: "Comitê de vendas até maio" com SIM em junho continua não batida.
- **RN-15** O objetivo pode ser único ou mensal. O resultado de cada mês é comparado ao objetivo daquele mês (situação mensal). O acumulado do ano é comparado ao objetivo do **último mês do período**.

### 5.4 Cálculo do resultado

- **RN-16** Resultado mensal = fórmula aplicada aos valores do mês. Se qualquer variável usada estiver vazia, o resultado do mês fica vazio.
- **RN-17** O resultado acumulado segue o modo de apuração da meta: (a) **fórmula sobre acumulados**: cada variável é acumulada pela sua regra nos meses do período e a fórmula é aplicada uma vez sobre esses valores; (b) **soma**, (c) **média**, (d) **máximo** ou (e) **último** dos resultados mensais com valor. O padrão para razões (A/B) é o modo (a).
- **RN-18** Divisão por zero gera resultado vazio com aviso "divisão por zero", nunca zero nem erro.
- **RN-19** Precisão: o cálculo interno usa precisão decimal total, sem arredondar etapas (salvo se a fórmula usar ARRED). Resultado, atendimento e pontos são arredondados a 2 casas na unidade exibida (80,00%; 2,64 dias; 7,58 pts), com arredondamento comercial (meio para cima).

### 5.5 Atendimento e pontuação

- **RN-20** Operadores: ≥, ≤, = e faixa (objetivo ± tolerância).
- **RN-21** Atendimento (R = resultado, O = objetivo, T = tolerância), sempre entre 0% e 100%:
  - ≥: R ≥ O → 100%; senão R ÷ O, se R > 0 e O > 0; senão 0%.
  - ≤: R ≤ O → 100%; senão O ÷ R, se R > 0 e O > 0; senão 0%.
  - =: |R − O| ≤ 0,005 → 100%; senão menor(R, O) ÷ maior(R, O), se ambos > 0; senão 0%.
  - faixa: O − T ≤ R ≤ O + T → 100%; senão 0%.
- **RN-22** Regra de pontuação configurável por meta: **tudo ou nada** (pontos = peso se atendimento = 100%, senão 0) ou **proporcional** (pontos = peso × atendimento). Metas de faixa são sempre tudo ou nada.
- **RN-23** O cadastro não permite pontuação proporcional quando o objetivo é ≤ 0 (ex.: Resíduo ≤ −10%), porque a razão perde sentido.
- **RN-24** Teto de 100%: nenhuma meta pontua acima do seu peso. Não há supermeta nem faixas de pontuação.
- **RN-25** Situação da meta: **Batida** (atendimento 100%), **Abaixo** (< 100%), **Fora da faixa** (faixa não atendida), **Sem dados** (nenhum resultado no período: atendimento 0, pontos 0).

### 5.6 Submetas

- **RN-26** Máximo de 2 níveis: meta → submeta.
- **RN-27** Atendimento da mãe = Σ (peso interno da submeta × atendimento da submeta), cada atendimento já limitado a 100%. Ex.: Engajamento = 5 submetas × 20%.
- **RN-28** A mãe é batida quando o atendimento composto chega a 100%. A pontuação da mãe usa a regra da mãe (tudo ou nada ou proporcional) sobre o atendimento composto.
- **RN-29** A submeta herda ciclo, setor e responsável da mãe; tem fórmula, operador, objetivo e período próprios (período contido no da mãe). A regra de pontuação da submeta não se aplica: ela só contribui com o atendimento.
- **RN-30** Se a mãe tiver variáveis e fórmula próprias, o resultado próprio entra na composição como um componente adicional, com peso interno, somando 100% junto com as submetas. Sem fórmula própria, a mãe só agrega.

### 5.7 Nota

- **RN-31** Nota do bloco = soma dos pontos das metas do bloco. Nota final = Corporativo + Departamental (0 a 100).
- **RN-32** Durante o ano, a nota é parcial: usa os meses lançados até o momento. Ao encerrar o ciclo, a nota é congelada.

### 5.8 Fechamento, reabertura, correção e carga histórica

- **RN-33** Dia útil = segunda a sexta, exceto feriados do calendário da empresa (Joinville/SC).
- **RN-34** O mês M aceita lançamentos do dia 1 de M até 23h59 do **15º dia útil do mês M+1** (contando a partir do 1º dia útil, inclusive). Meses posteriores ao mês corrente não aceitam lançamento.
- **RN-35** A trava é verificada no servidor em toda gravação. Um job diário apenas atualiza o status exibido e dispara notificações.
- **RN-36** Reabertura: só o Administrador; informa escopo (mês + setor, gestor ou todos), data-limite, motivo e quem autorizou (o Gerente Geral, combinado fora do sistema). Ao vencer a data-limite, o mês volta a fechar sozinho.
- **RN-37** Correção (Fase 2): o gestor pede com valor novo e justificativa; o Gerente Geral aprova ou recusa com motivo. Só um pedido pendente por variável e mês. Aprovado, o valor é aplicado e o anterior fica no histórico com referência ao pedido.
- **RN-38** Carga histórica: só o Administrador, em qualquer mês de qualquer ciclo, ignorando a trava; todo valor recebe origem "carga histórica".
- **RN-39** Alterações de meta (peso, objetivo, fórmula, período) num ciclo ativo são permitidas ao Administrador, ficam no histórico com antes/depois e disparam recálculo. Ciclo encerrado não aceita alteração.

### 5.9 Histórico e importação

- **RN-40** O histórico é somente inclusão (ninguém edita nem apaga): lançamentos, metas, pesos, objetivos, fórmulas, reaberturas, correções, importações e permissões.
- **RN-41** Importação Excel é transacional: valida tudo, mostra prévia e grava tudo ou nada. O gestor importa só nas suas variáveis e em meses abertos; o Administrador importa em qualquer mês como carga histórica.

### 5.10 Avaliação de comportamentos (Fase 2)

- **RN-42** Notas de 1 a 5 em 32 comportamentos (8 competências × 4), em 3 momentos independentes. Média da competência = média dos comportamentos avaliados; média geral = média dos 32, ignorando vazios.
- **RN-43** A meta "Modelo de liderança" do gestor usa a média geral da avaliação mais recente que ele recebeu do superior.

## 6. Motor de cálculo

O motor é um módulo puro (sem acesso a banco ou HTTP): recebe a definição das metas e os lançamentos e devolve resultados. Assim ele é testável isoladamente e o mesmo código roda no servidor (fonte oficial) e no navegador (prévia enquanto o gestor digita).

### 6.1 Etapas, para cada meta e ciclo

1. **Resultado mensal.** Para cada mês de 1 a 12, monta o escopo com os valores das variáveis daquele mês e avalia a fórmula (RN-16). Meses fora do período também são calculados, marcados como histórico.
2. **Situação mensal.** Compara o resultado do mês com o objetivo do mês (RN-15), só para exibição.
3. **Acumulado do período.** Aplica o modo de apuração (RN-17) sobre os meses do período.
4. **Atendimento.** Compara o acumulado com o objetivo do último mês do período, conforme o operador (RN-21).
5. **Submetas.** Se a meta tem filhas, calcula cada filha (etapas 1 a 4) e compõe o atendimento da mãe (RN-27, RN-30).
6. **Pontuação.** Aplica a regra (tudo ou nada ou proporcional) e o peso da atribuição ao gestor (RN-22). Meta corporativa: um resultado, uma pontuação por gestor atribuído.
7. **Nota.** Soma por bloco e total do gestor (RN-31).

### 6.2 Linguagem de fórmulas

Sintaxe parecida com a do Excel em português, para o Administrador escrever sem treinamento. A fórmula é texto; ao salvar, é convertida numa árvore sintática (AST) guardada em JSON junto com a lista de variáveis referenciadas.

| Elemento | Sintaxe | Exemplo |
| --- | --- | --- |
| Variável | Código em maiúsculas, letras, números e _ | PRESENCAS / EVENTOS |
| Números | Ponto ou vírgula decimal | 0,5 ou 0.5 |
| Aritmética | + - * / e parênteses | (ADMISSOES + DEMISSOES) / 2 / TOTAL_COLAB |
| Comparação | = <> < > <= >= (devolve 1 ou 0) | ENTREGUES >= PLANEJADAS |
| Condicional | SE(cond; se_verdadeiro; se_falso) | SE(IMPLANTADO = 1; 1; 0) |
| Lógicas | E(a; b; …), OU(a; b; …), NAO(a) | E(A > 0; B > 0) |
| Arredondar | ARRED(x; casas) | ARRED(MEDIA_DIAS; 0) |
| Outras | MIN, MAX, ABS | 1 - REALIZADO / ABS(ORCADO) |
| Ano anterior (Fase 2) | ANTERIOR(VAR): mesmo mês (ou acumulado) do ciclo anterior | 1 - TARIFAS / ANTERIOR(TARIFAS) |
| Outra meta (Fase 2) | META("codigo"): resultado de outra meta no mesmo mês | META("MODELO_LIDERANCA") |

Separador de argumentos: ;. A vírgula também separa argumentos quando não pode ser decimal: em ARRED(X,2) ela separa, porque X não é número; em ARRED(3,2) ela é decimal, o que gera erro de quantidade de argumentos com a sugestão de usar ;. Funções e variáveis não diferenciam maiúsculas de minúsculas na digitação e são gravadas em maiúsculas. Precedência: menos unário, depois * /, depois + -, depois comparação.

**Resolução de nomes.** O código da variável é único por ciclo e setor, porque o mesmo modelo (ex.: Check lists) cria CHECKLISTS em vários setores. Na fórmula, um código simples procura a variável no setor da própria meta. Para usar a variável de outro setor, prefixe com o código do setor: RH.TOTAL_COLAB, CORP.ENTRADAS_CAIXA.

**Implementação.** Parser próprio (descendente recursivo, cerca de 300 linhas em TypeScript), sem eval nem new Function, com aritmética decimal (decimal.js) para evitar erros de ponto flutuante em R$. Não há laços, atribuições nem acesso a nada fora do escopo de variáveis: a fórmula não executa código.

**Validação ao salvar:** sintaxe; variáveis existentes no ciclo; funções conhecidas e número de argumentos; ausência de referência circular entre metas (Fase 2); execução de teste com valores de exemplo. Erros aparecem em português com a posição ("Esperava ')' perto de 'EVENTOS'").

### 6.3 Atendimento

Com R = resultado acumulado, O = objetivo do último mês do período e T = tolerância, limitado a [0, 1]:

$$
\text{At}_{\geq} = \begin{cases} 1 & R \geq O \\ R/O & R>0,\ O>0 \\ 0 & \text{caso contrário} \end{cases} \qquad \text{At}_{\leq} = \begin{cases} 1 & R \leq O \\ O/R & R>0,\ O>0 \\ 0 & \text{caso contrário} \end{cases}
$$

$$
\text{At}_{=} = \begin{cases} 1 & |R-O| \leq 0{,}005 \\ \min(R,O)/\max(R,O) & R>0,\ O>0 \\ 0 & \text{caso contrário} \end{cases} \qquad \text{At}_{\pm} = \begin{cases} 1 & O-T \leq R \leq O+T \\ 0 & \text{caso contrário} \end{cases}
$$

### 6.4 Submetas e pontuação

$$
\text{At}_{mãe} = \sum_{i} p_i \cdot \min(\text{At}_i, 1), \quad \sum_i p_i = 1 \qquad\qquad \text{Pts} = \begin{cases} \text{Peso} \cdot \text{At} & \text{proporcional} \\ \text{Peso} \cdot [\text{At} = 1] & \text{tudo ou nada} \end{cases}
$$

Exemplo, Engajamento da Julia (jan–out/2026), 5 submetas a 20%: Participação em eventos 43/48 = 89,58% contra ≥ 90% dá atendimento de 99,54%; Jornada 0,56% contra ≤ 3% dá 100%; Projeto melhoria 0% dá 0%; Modelo de liderança 3,04 contra ≥ 3 dá 100%; Turnover depende da fórmula a confirmar (seção 14). Supondo Turnover em 100%: atendimento da mãe = 20% × (99,54 + 100 + 100 + 0 + 100)% = **79,91%**, não batida. Com peso 10 proporcional: 7,99 pts; tudo ou nada: 0 pts.

### 6.5 Quando recalcular

O recálculo é por eventos e por escopo, nunca "recalcular tudo" em cada clique:

| Evento | Escopo do recálculo |
| --- | --- |
| Lançamento salvo, importado ou corrigido | Metas que usam a variável; suas mães; notas dos gestores atribuídos |
| Meta alterada (fórmula, objetivo, período, peso, regra) | A meta, sua mãe e as notas dos gestores atribuídos |
| Variável alterada (regra de acumulação) | Metas que a usam |
| Encerramento do ciclo | Ciclo inteiro, e grava a fotografia final |

Com cerca de 7 gestores, 150 metas e 300 variáveis por ciclo, o recálculo de um ciclo inteiro leva milissegundos. Os resultados ficam gravados em tabelas de resultado (seção 7) para leitura rápida, pelo dashboard e pelo Power BI.

### 6.6 Pseudocódigo do acumulado

```
acumulado(meta, ciclo):
  meses = meta.periodo (ex.: 1..12 ou 7..12)
  se meta.modo == 'FORMULA_SOBRE_ACUMULADOS':
      escopo = {}
      para cada var em meta.variaveis:
          vals = [lanc(var, m) para m em meses se lanc != vazio]
          se vals vazio: retorna VAZIO
          escopo[var] = acumula(vals, var.regra)   # soma | media | ultimo | maximo
      retorna avalia(meta.formula, escopo)        # divisão por zero -> VAZIO
  senão:
      res = [resultado_mensal(meta, m) para m em meses se != vazio]
      se res vazio: retorna VAZIO
      retorna agrega(res, meta.modo)              # soma | media | maximo | ultimo
```

## 7. Modelo de dados (PostgreSQL)

São 33 tabelas em 6 grupos, mais um schema bi só de leitura. Convenções: chaves uuid; valores em numeric(18,6) (nunca float); datas em timestamptz; mês como smallint 1–12 com CHECK; enums como tipos PostgreSQL; toda tabela de negócio tem criado_em, criado_por, atualizado_em, atualizado_por.

### 7.1 Organização e acesso

| Tabela | Campos principais | Observações |
| --- | --- | --- |
| usuario | id, entra_oid (único), nome, email (único), perfil (ADMIN, DIRETORIA, GESTOR, LEITOR), gerente_geral (bool), superior_id, ativo | entra_oid = identificador do usuário no Entra ID; criado no 1º login como LEITOR inativo |
| setor | id, codigo (único, ex.: RH, FISCAL, CORP), nome, corporativo (bool), ativo | Um único setor com corporativo = true |
| ciclo | id, ano (único), status (RASCUNHO, ATIVO, ENCERRADO), encerrado_em, encerrado_por |  |
| setor_responsavel | ciclo_id, setor_id, usuario_id | PK (ciclo_id, setor_id): um gestor por setor e ciclo |
| leitor_setor | usuario_id, setor_id | Setores visíveis ao perfil Leitor |
| feriado | id, data (única), descricao, tipo (NACIONAL, ESTADUAL, MUNICIPAL, EMPRESA) | Calendário de Joinville mantido pelo Administrador |

### 7.2 Catálogo e metas

| Tabela | Campos principais | Observações |
| --- | --- | --- |
| modelo_meta | id, codigo, nome, metrica, unidade, formula, modo_apuracao, operador_sugerido, ativo | Sem peso nem objetivo |
| modelo_variavel | id, modelo_id, codigo, nome, tipo, acumulacao | Variáveis que o modelo cria ao ser aplicado |
| variavel | id, ciclo_id, setor_id, codigo, nome, tipo (NUMERO, PERCENTUAL, MOEDA, DIAS, HORAS, SIM_NAO), acumulacao (SOMA, MEDIA, ULTIMO, MAXIMO), origem (DIGITADA, IMPORTADA), responsavel_id (só Corporativo), casas_decimais, ativo | Único (ciclo_id, setor_id, codigo) |
| meta | id, ciclo_id, setor_id, meta_pai_id, modelo_id, codigo, indicador, metrica, unidade, formula_texto, formula_ast (jsonb), modo_apuracao, operador (GE, LE, EQ, FAIXA), tolerancia, mes_inicio, mes_fim, regra_pontuacao (TUDO_OU_NADA, PROPORCIONAL), peso_interno, responsavel_id, ordem, ativo, versao | meta_pai_id aponta só para meta sem pai (2 níveis, garantido por trigger); peso_interno só em submeta ou componente próprio da mãe |
| meta_variavel | meta_id, variavel_id | Derivada da AST ao salvar; responde "quais metas usam esta variável" |
| meta_objetivo | meta_id, mes (0 = único, 1–12), valor | Objetivo único ou mensal |
| meta_atribuicao | id, meta_id, usuario_id, peso | Uma linha por gestor pontuado. Meta comum: 1 linha (o responsável). Corporativa: N linhas. Submeta: nenhuma |

### 7.3 Lançamentos e governança

| Tabela | Campos principais | Observações |
| --- | --- | --- |
| lancamento | id, variavel_id, mes, valor (nulo = vazio), origem (DIGITACAO, IMPORTACAO, CARGA_HISTORICA, CORRECAO), atualizado_por, atualizado_em, versao | Único (variavel_id, mes); versao para controle de concorrência otimista |
| lancamento_historico | id, lancamento_id, valor_anterior, valor_novo, origem, usuario_id, em, importacao_id, correcao_id, reabertura_id | Somente inclusão (RN-40) |
| reabertura | id, ciclo_id, mes, escopo (TODOS, SETOR, GESTOR), escopo_id, valido_ate, motivo, autorizado_por (texto), criado_por, cancelada_em |  |
| correcao (Fase 2) | id, variavel_id, mes, valor_atual, valor_proposto, justificativa, status (PENDENTE, APROVADA, RECUSADA, CANCELADA), solicitado_por, decidido_por, decidido_em, motivo_decisao | Índice único parcial: um PENDENTE por (variavel_id, mes) |
| evidencia (Fase 2) | id, variavel_id, mes, nome_arquivo, mime, tamanho, sha256, caminho, enviado_por | Arquivo em disco; até 10 MB |
| comentario (Fase 2) | id, variavel_id, mes, texto, autor_id |  |
| importacao | id, arquivo_nome, modo (GESTOR, CARGA_HISTORICA), linhas_total, linhas_gravadas, status, erros (jsonb), usuario_id |  |

### 7.4 Resultados (gravados pelo motor)

| Tabela | Campos principais | Observações |
| --- | --- | --- |
| resultado_meta_mes | meta_id, mes, resultado, objetivo, atendimento, situacao, fora_periodo, aviso, calculado_em | PK (meta_id, mes) |
| resultado_meta | meta_id, resultado_acumulado, objetivo_usado, atendimento, situacao, memoria (jsonb), calculado_em | memoria guarda acumulados, fórmula e passos (RF-38) |
| resultado_atribuicao | atribuicao_id, pontos, calculado_em | Pontos do gestor naquela meta |
| nota_gestor | ciclo_id, usuario_id, bloco (CORPORATIVO, DEPARTAMENTAL), peso_total, pontos, calculado_em | Nota parcial corrente |
| nota_fechamento | ciclo_id, usuario_id, bloco, pontos, dados (jsonb), congelado_em | Fotografia ao encerrar o ciclo |

### 7.5 Avaliação de comportamentos (Fase 2)

| Tabela | Campos principais | Observações |
| --- | --- | --- |
| competencia | id, ciclo_id, nome, premissa, motivacao, ordem | 8 por ciclo |
| comportamento | id, competencia_id, numero (1–32), texto |  |
| funcionario | id, nome, setor_id, avaliador_id (usuario), usuario_id (se também for usuário), ativo | Sem login |
| avaliacao | id, ciclo_id, momento (INICIO, MEIO, FIM), funcionario_id, avaliador_id, status (RASCUNHO, CONCLUIDA), concluida_em | Único (ciclo, momento, funcionario) |
| avaliacao_nota | avaliacao_id, comportamento_id, nota (1–5) |  |
| avaliacao_comentario | avaliacao_id, competencia_id, texto |  |

### 7.6 Auditoria e notificações

| Tabela | Campos principais | Observações |
| --- | --- | --- |
| auditoria | id, entidade, entidade_id, acao, antes (jsonb), depois (jsonb), usuario_id, em, ip | Metas, pesos, fórmulas, permissões, ciclos |
| notificacao (Fase 2) | id, tipo, destinatario_id, assunto, corpo, agendada_para, enviada_em, status, erro | Fila de e-mails |

### 7.7 Schema bi (Power BI e dashboard)

Views só de leitura, acessadas por um usuário PostgreSQL bi_leitor sem permissão de escrita: bi.dim_ciclo, bi.dim_setor, bi.dim_gestor, bi.dim_meta (com mãe, bloco, operador, unidade), bi.fato_resultado_mes (meta × mês: resultado, objetivo, situação, histórico), bi.fato_meta (acumulado, atendimento), bi.fato_pontos (gestor × meta: peso, pontos) e bi.fato_nota (gestor × bloco). Os nomes das colunas ficam estáveis entre versões, para não quebrar relatórios.

## 8. Arquitetura técnica

Aplicação web em três camadas no servidor Windows interno: o IIS publica o front-end React e encaminha /api para a API Node; um serviço de jobs Node cuida de fechamento, notificações e importações; o PostgreSQL guarda tudo. O login é feito no Entra ID (Microsoft 365). O motor de cálculo é um pacote compartilhado entre front e back.

arquitetura · servidor Windows interno, login no Entra ID

O navegador fala só com o IIS da rede interna e com o Entra ID para o login. A API concentra regras e cálculo; os jobs cuidam do que roda por horário.

### 8.1 Componentes e tecnologias

| Camada | Tecnologia recomendada | Papel |
| --- | --- | --- |
| Repositório | Monorepo com pnpm workspaces; TypeScript estrito (strict, noUncheckedIndexedAccess); ESLint + Prettier | Um repositório para front, API, jobs e pacotes compartilhados |
| Front-end | React 18 + TypeScript + Vite; MUI (componentes responsivos); TanStack Query; React Router; React Hook Form + Zod; ECharts | Telas para celular, tablet e desktop; prévia de cálculo no navegador |
| Autenticação no front | MSAL React (@azure/msal-react), Authorization Code + PKCE | Login Microsoft, token de acesso para a API |
| API | Node.js 26 LTS + TypeScript + NestJS (módulos, guards, validação) | Regras de negócio, permissões, trava, gravação e recálculo |
| Validação de token | jose com JWKS do tenant (tokens v2 do Entra ID) | Confere assinatura, emissor, audiência e expiração |
| Acesso a dados | Prisma (migrações versionadas, tipo Decimal) | Esquema da seção 7 |
| Motor de cálculo | Pacote @metas/motor: parser de fórmulas + cálculo + calendário, TypeScript puro com decimal.js | Mesmo código no servidor (oficial) e no navegador (prévia) |
| Datas e fuso | Luxon, sempre em America/Sao_Paulo nas regras de fechamento | Dias úteis e data de fechamento |
| Esquemas compartilhados | Pacote @metas/tipos com enums e schemas Zod | Mesmas validações no front e na API |
| Jobs | Serviço Node separado com pg-boss (fila sobre o próprio PostgreSQL, sem Redis) | Status de fechamento às 00h05, reaberturas vencidas, e-mails, importações grandes |
| Banco | PostgreSQL 16 | Dados, filas e schema bi |
| Excel | exceljs | Modelo de importação, leitura e exportação |
| E-mail (Fase 2) | Microsoft Graph sendMail (permissão de aplicação Mail.Send numa caixa de serviço) ou relay SMTP interno | Lembretes e avisos |
| Testes | Vitest (unitários e integração), Supertest (API), Playwright (ponta a ponta) | Motor com 100% de cobertura; casos da seção 12 automatizados |
| Servidor web | IIS + URL Rewrite + ARR como proxy reverso, HTTPS | Arquivos estáticos do React, proxy para a API |
| Execução dos serviços Node | NSSM (serviços do Windows com reinício automático) | API e jobs como serviços |
| Logs | pino em JSON, arquivos com rotação diária | Diagnóstico e correlação por requestId |

As versões exatas são fixadas no package.json na instalação e registradas em docs/decisoes.md.

### 8.2 Organização do código (monorepo pnpm)

```
metas/
  apps/web      # React (Vite)
  apps/api      # NestJS: módulos auth, cadastros, metas, lancamentos, fechamento, importacao, resultados, comportamentos
  apps/jobs     # pg-boss workers
  packages/motor  # parser + cálculo (sem dependência de banco/HTTP), 100% coberto por testes
  packages/tipos  # DTOs e schemas Zod compartilhados
  prisma/       # schema e migrações
```

### 8.3 Autenticação e autorização

- Registro de aplicativo no Entra ID (já disponível): um app SPA com redirect https://<host interno>/ e um escopo de API api://metas/acesso, configurado para tokens v2. O sistema pede só o perfil básico (openid profile email).
- A API valida o JWT (assinatura, emissor https://login.microsoftonline.com/<tenant>/v2.0, audiência, expiração) e mapeia o oid para a tabela usuario.
- No primeiro acesso, o usuário é criado como Leitor inativo; o Administrador define o perfil e ativa.
- **Perfis ficam no banco do sistema**, não em grupos do Entra ID, porque quem os administra é o Administrador do sistema.
- **Modo de desenvolvimento:** com NODE_ENV=development e AUTH_DEV=true, a API simula um usuário sem passar pelo Entra ID. A API se recusa a iniciar com AUTH_DEV=true em produção.
- Autorização por recurso, centralizada num serviço de políticas: "pode lançar a variável X no mês M?" verifica perfil, responsabilidade pelo setor (RN-07), status do mês (RN-34), reabertura vigente e carga histórica. Nenhuma tela decide permissão sozinha.

### 8.4 Rede interna, HTTPS e celulares

O sistema só é acessível na rede da empresa (Wi-Fi corporativo ou VPN). Três cuidados:

1. **HTTPS é obrigatório.** O Entra ID só aceita redirect HTTPS fora de localhost.
2. **Certificado confiável em celulares.** Certificado de CA interna exige instalar a CA em cada celular e tablet, o que é trabalhoso em aparelhos não gerenciados. Recomendação: usar um nome do domínio público da empresa (ex.: metas.<empresa>.com.br) resolvido só no DNS interno para o IP do servidor, com certificado público (ex.: Let's Encrypt por desafio DNS, renovação automática via win-acme). Fica confiável em qualquer aparelho e continua inacessível de fora.
3. **Os aparelhos precisam de internet** para alcançar login.microsoftonline.com durante o login.

### 8.5 Arquivos, backup e ambientes

- **Evidências** (Fase 2) em pasta fora do site, ex.: D:\metas-dados\evidencias\<ano>\<uuid>, servidas só pela API após checar permissão. Nome original e hash SHA-256 guardados no banco.
- **Backup:** pg_dump diário com retenção de 30 dias e cópia para outro servidor ou compartilhamento; backup da pasta de evidências no mesmo horário; teste de restauração mensal.
- **Ambientes:** desenvolvimento (máquinas da equipe), homologação e produção, que podem ficar no mesmo servidor com bancos e portas separados. Deploy por script PowerShell a partir do pacote gerado no CI.

### 8.6 Dashboard e Power BI

Sem licenças Power BI Pro, publicar e compartilhar relatórios no Power BI Service normalmente não é possível; a TI deve confirmar o licenciamento com o fornecedor. Por isso a recomendação é:

- **Dashboard nativo no sistema (Fase 2)**, com ECharts, lendo as tabelas de resultado. Atende todos os usuários, sem licença e com as mesmas permissões do sistema.
- **Schema** **bidisponível desde a Fase 1** para quem quiser montar análises no Power BI Desktop (gratuito, uso individual).

## 9. Fluxos

Sete fluxos cobrem o uso do sistema. O mais frequente é o lançamento mensal; os demais são pontuais e quase todos exclusivos do Administrador.

### 9.1 Preparar o ciclo (Administrador, novembro/dezembro)

1. Criar o ciclo do ano (Rascunho) ou copiar o anterior (Fase 2, RF-46).
2. Conferir setores e definir o gestor responsável de cada setor no ciclo.
3. Atualizar o calendário de feriados do ano.
4. Cadastrar variáveis e metas, aplicando modelos do catálogo quando houver.
5. Atribuir metas corporativas aos gestores, com peso.
6. Revisar o painel de consistência: pesos por gestor (50/50 ou 100), submetas somando 100%, fórmulas válidas, variáveis sem responsável.
7. Ativar o ciclo. O sistema bloqueia a ativação enquanto houver inconsistência.

### 9.2 Lançamento mensal (Gestor)

1. O gestor abre "Lançamentos". O sistema seleciona o mês aberto mais antigo com pendências e mostra o prazo ("fecha em 24/11, faltam 9 dias úteis").
2. A tela lista as variáveis do gestor, agrupadas por meta; uma variável compartilhada aparece uma vez.
3. Ao digitar, o resultado do mês e o acumulado recalculam no navegador.
4. Ao salvar, a API revalida permissão e trava, grava os valores e o histórico na mesma transação e dispara o recálculo oficial.
5. Se outra pessoa alterou o mesmo valor nesse meio-tempo, a API recusa com conflito (campo versao) e a tela mostra o valor atual.

### 9.3 Fechamento do mês

O mês M fecha no fim do 15º dia útil de M+1. Exemplos, considerando os feriados nacionais do período (o calendário da empresa pode acrescentar outros):

| Mês de competência | Feriados considerados | Fecha em |
| --- | --- | --- |
| Outubro/2026 | 02/11 (Finados), 20/11 (Consciência Negra) | 24/11/2026, 23h59 |
| Dezembro/2026 | 01/01 (Confraternização) | 22/01/2027, 23h59 |

Linha do tempo de cada fechamento:

| Momento | O que acontece |
| --- | --- |
| Dia 1 de M | M passa a aceitar lançamentos |
| 5 dias úteis antes do fechamento | E-mail ao gestor com as pendências (Fase 2) |
| 2 dias úteis antes | Segundo lembrete (Fase 2) |
| 23h59 do 15º dia útil de M+1 | M trava para os gestores; a API já recusa gravações a partir de 00h00 |
| 00h05 do dia seguinte | Job atualiza o status e envia à Diretoria a lista de quem deixou pendências (Fase 2) |

### 9.4 Reabertura (Administrador)

1. O Gerente Geral autoriza fora do sistema.
2. O Administrador escolhe ciclo, mês e escopo (todos, um setor ou um gestor), a data-limite, o motivo e o nome de quem autorizou.
3. Os gestores do escopo voltam a lançar naquele mês até a data-limite; cada valor gravado fica ligado à reabertura no histórico.
4. Na data-limite, o mês fecha de novo. O Administrador pode encerrar antes.

### 9.5 Correção em mês fechado (Fase 2)

1. No mês fechado, o gestor clica em "Pedir correção" na variável, informa o valor novo e a justificativa (obrigatória) e pode anexar evidência.
2. O Gerente Geral recebe e-mail e vê o pedido em "Aprovações", com o valor atual, o proposto e o impacto calculado no resultado e na nota.
3. Aprovado: o valor é aplicado, o histórico registra antes, depois e o pedido, e o sistema recalcula. Recusado: nada muda; o gestor recebe o motivo.
4. Enquanto estiver pendente, o gestor pode cancelar o pedido.

### 9.6 Carga histórica e importação Excel

1. O usuário baixa o modelo (colunas: ciclo, mês, setor, código da variável, valor).
2. Envia o arquivo preenchido. O sistema valida cada linha: variável existe, tipo e faixa do valor (SIM/NÃO, percentual de 0 a 100), mês, permissão e trava.
3. A prévia mostra linhas válidas, erros por linha e quais valores serão sobrescritos (antes → depois).
4. Ao confirmar, grava tudo numa transação, ou nada. Origem: IMPORTACAO para gestor e CARGA_HISTORICA para Administrador.

Os dados de 2026 entram por esse fluxo, como carga histórica, depois que as metas de 2026 forem cadastradas no sistema.

### 9.7 Avaliação de comportamentos (Fase 2)

1. O Administrador abre o momento de avaliação (início, meio ou fim do ano) com prazo.
2. Cada gestor vê seus funcionários e preenche, para cada um, as notas de 1 a 5 nos 32 comportamentos e um comentário por competência. Pode salvar rascunho.
3. Ao concluir, o sistema calcula as médias por competência e a média geral e mostra o resultado e a evolução entre os momentos.
4. Os superiores avaliam os gestores do mesmo jeito; essa média alimenta a meta "Modelo de liderança" do gestor (RN-43).

## 10. API e telas

A API é REST com JSON, prefixo /api/v1, documentada em OpenAPI (Swagger) gerado pelo NestJS. Toda rota exige token válido; as permissões seguem a seção 3.

### 10.1 Principais rotas

| Recurso | Rotas | Quem usa |
| --- | --- | --- |
| Sessão | GET /me (usuário, perfil, setores, pendências) | Todos |
| Cadastros | GET/POST/PUT /usuarios, /setores, /feriados, /ciclos, /ciclos/{id}/responsaveis | Admin |
| Ciclo | POST /ciclos/{id}/ativar, POST /ciclos/{id}/encerrar, GET /ciclos/{id}/consistencia, POST /ciclos/{id}/copiar (F2) | Admin |
| Modelos | GET/POST/PUT /modelos, POST /modelos/{id}/aplicar | Admin |
| Variáveis | GET/POST/PUT /ciclos/{id}/variaveis | Admin |
| Metas | GET/POST/PUT /ciclos/{id}/metas, GET /metas/{id} (com submetas, objetivos, atribuições), PUT /metas/{id}/objetivos, PUT /metas/{id}/atribuicoes | Admin; leitura conforme perfil |
| Fórmulas | POST /formulas/validar (texto + variáveis → erros, variáveis usadas, resultado de teste) | Admin |
| Lançamentos | GET /lancamentos?ciclo&mes (variáveis do usuário, valores, status do mês), PUT /lancamentos (lote, com versao por item) | Gestor, Admin (carga histórica) |
| Histórico | GET /lancamentos/{id}/historico, GET /auditoria | Conforme perfil |
| Fechamento | GET /calendario/{ciclo} (data de fechamento de cada mês), POST/DELETE /reaberturas | Todos / Admin |
| Correções (F2) | POST /correcoes, GET /correcoes?status, POST /correcoes/{id}/aprovar, /recusar, /cancelar | Gestor, Gerente Geral |
| Importação | GET /importacao/modelo, POST /importacao/previa (arquivo), POST /importacao/{id}/confirmar | Gestor, Admin |
| Resultados | GET /resultados/gestor/{id}?ciclo, GET /resultados/meta/{id} (com memória de cálculo), GET /exportacao?ciclo&gestor | Conforme perfil |
| Evidências (F2) | POST /evidencias, GET /evidencias/{id}/arquivo, POST /comentarios | Gestor, Admin |
| Comportamentos (F2) | /funcionarios, /avaliacoes, PUT /avaliacoes/{id}/notas, POST /avaliacoes/{id}/concluir | Gestor, Diretoria |
| Dashboard (F2) | GET /dashboard/... conforme o layout que será enviado | Conforme perfil |

Erros seguem um formato único: { codigo, mensagem, detalhes }, com mensagens em português (ex.: MES_FECHADO, SEM_PERMISSAO_VARIAVEL, CONFLITO_VERSAO, FORMULA_INVALIDA).

### 10.2 Telas

| Tela | Perfil | Conteúdo |
| --- | --- | --- |
| Início | Todos | Nota parcial, pendências do mês e prazo de fechamento, atalhos |
| Minhas metas | Gestor | Metas por bloco, acumulado, atendimento, pontos e situação; detalhe com resultado mês a mês e memória de cálculo |
| Lançamentos | Gestor | Seletor de mês (aberto, fechado, futuro), variáveis por meta, prévia ao digitar, salvar em lote |
| Importar | Gestor, Admin | Modelo, envio, prévia e confirmação |
| Visão geral | Diretoria, Admin, Leitor | Todos os gestores e setores, notas, pendências por mês |
| Aprovações (F2) | Gerente Geral | Pedidos de correção com impacto calculado |
| Metas (cadastro) | Admin | Lista por ciclo, setor e gestor; editor com as 5 etapas do protótipo: o que é, variáveis, fórmula com teste, acumulação e período, objetivo e pontuação; submetas |
| Catálogo de modelos | Admin | Modelos e onde foram aplicados |
| Variáveis | Admin | Por setor, com metas que usam cada uma |
| Ciclos e consistência | Admin | Status, pesos por gestor, alertas que impedem ativar |
| Fechamento | Admin | Calendário, datas de fechamento, reaberturas |
| Cadastros | Admin | Usuários, setores, responsáveis, feriados |
| Histórico | Conforme perfil | Filtros por meta, variável, usuário e período |
| Avaliações (F2) | Gestor, Diretoria | Funcionários, formulário dos 32 comportamentos, resultados |
| Dashboard (F2) | Conforme perfil | Conforme o layout enviado |

O protótipo interativo já publicado (versão de teste) serve de referência visual para Minhas metas, Lançamentos, cadastro de Metas e Histórico.

## 11. Requisitos não funcionais

| ID | Categoria | Requisito |
| --- | --- | --- |
| RNF-01 | Responsividade | Telas funcionais de 360 px (celular) a 1920 px (desktop). Lançamento e consulta de metas são projetados primeiro para celular. Alvos de toque ≥ 44 px. |
| RNF-02 | Navegadores | Últimas 2 versões de Edge, Chrome, Safari (iOS) e Chrome (Android). |
| RNF-03 | Desempenho | Telas principais carregam em < 2 s na rede interna; salvar lançamentos e recalcular em < 1 s; importação de 5.000 linhas em < 30 s. |
| RNF-04 | Capacidade | Dimensionado para 20 gestores, 50 setores, 500 metas e 1.000 variáveis por ciclo, sem mudança de arquitetura. |
| RNF-05 | Disponibilidade | Horário comercial; manutenções fora dos 15 dias úteis de lançamento sempre que possível. |
| RNF-06 | Segurança | HTTPS obrigatório; login só pelo Entra ID; autorização checada na API em toda requisição; cabeçalhos de segurança (CSP, HSTS); limite de taxa nas rotas; uploads checados por tipo real e tamanho; senhas e segredos fora do código (variáveis de ambiente protegidas). |
| RNF-07 | Integridade | Gravações em transação; controle de concorrência otimista em lançamentos; histórico somente inclusão. |
| RNF-08 | Precisão | Valores em numeric; cálculos com decimal.js; nenhum float no caminho do dinheiro ou das notas. |
| RNF-09 | Rastreabilidade | Todo valor exibido tem origem consultável: quem lançou, quando, por qual canal (digitação, importação, carga histórica, correção). |
| RNF-10 | LGPD | Avaliações de comportamento são dados pessoais de funcionários: visíveis só ao avaliador, à Diretoria e ao Admin; retenção definida pelo RH; exportação registrada na auditoria. |
| RNF-11 | Acessibilidade | Contraste mínimo AA, navegação por teclado, rótulos em todos os campos. |
| RNF-12 | Idioma e formatos | Português do Brasil; números com vírgula decimal; datas dd/mm/aaaa; fuso America/Sao_Paulo em regras de fechamento. |
| RNF-13 | Testes | Motor de cálculo com 100% de cobertura e os casos da seção 12 como testes automatizados; testes de API para permissão e trava; testes de ponta a ponta do fluxo de lançamento (Vitest, Supertest e Playwright). |
| RNF-14 | Operação | Logs estruturados com rotação; rota de saúde /api/v1/saude (banco, fila); backup diário com restauração testada mensalmente. |
| RNF-15 | Manutenibilidade | TypeScript estrito em todo o código; lint e formatação no CI; migrações de banco versionadas; README de instalação no servidor Windows. |

## 12. Casos de teste

Os 18 casos abaixo usam dados reais das três planilhas (2026) e devem virar testes automatizados do motor (RNF-13). A coluna "Planilha hoje" mostra o que a planilha calcula, quando difere: é o erro que o sistema corrige.

### 12.1 Cálculo de metas

| ID | Meta (origem) | Configuração | Entradas | Esperado | Planilha hoje |
| --- | --- | --- | --- | --- | --- |
| CT-01 | Sistema de gestão da qualidade (Leonardo) | REQ_ATENDIDOS / TOTAL_REQ; ambas soma; fórmula sobre acumulados; ≥ 80% | jan 16/20; fev 20/25 | 36/45 = 80,00%; atendimento 100%; Batida | igual |
| CT-02 | Check lists (Julia, RH) | CHECKLISTS / PROC_CRITICOS; ambas **último**; ≥ 90% | jan–out: 0, 0, 0, 5, 5, 5, 10, 10, 10, 10 / 10 por mês | 10/10 = 100,00%; Batida | 681,82% |
| CT-03 | Tempo de resposta – propostas (Leonardo) | MEDIA_DIAS; média dos resultados; ≤ 2 dias; peso 10 | jan–ago: 5,2; 0,43; 3; 1,17; 1,14; 2; 1,67; 6,5 | 2,64 dias; atendimento 75,79%; tudo ou nada 0,00 pts; proporcional 7,58 pts | 2,00 dias e Batida (meses vazios contados como zero) |
| CT-04 | Orçado × realizado (Leonardo) | (REALIZADO - ORCADO) / ORCADO; ambas soma; faixa 0 ± 5% | jan–nov: realizado 103.080,27; orçado 152.946,99 | −32,60%; Fora da faixa; 0 pts | igual |
| CT-05 | Comitê de vendas (Leonardo) | SIM/NÃO; período jan–mai; máximo | SIM em mai | 1; Batida | igual |
| CT-06 | Comitê de vendas (variação) | Igual ao CT-05 | SIM só em jun | Período = 0; Abaixo; jun exibido como histórico | — |
| CT-07 | Retrabalho NFs (Julia, Fiscal) | RETRABALHO / NFS; ambas soma; **≤ 5%** (operador a confirmar, seção 14); proporcional; peso 10 | jan–set: 99 retrabalhos / 707 NFs | 14,00%; atendimento 35,71%; 3,57 pts | ≥ 105%, 0 pts |
| CT-08 | Reforma tributária (Julia, Fiscal) | PCT_IMPL; último; = 100%; peso 15 | nov: 90% | 90,00%; atendimento 90%; tudo ou nada 0 pts; proporcional 13,50 pts | igual (0 pts) |
| CT-09 | Resíduo (Evandro, Fábrica) | PCT_REDUCAO; último; ≤ −10% | set: −19,79% | Batida; cadastro recusa "proporcional" (RN-23) | Batida, 0 pts (operador ignorado) |
| CT-10 | Planejamento produção (Evandro, PCPM) | MEDIA_DIAS; média; ≤ 3 dias | jan–out: −6; −12,8; −11,7; −9,5; −2,5; −6,5; 0,5; −3; −10,3; −2,3 | −6,41 dias; Batida | igual |
| CT-11 | Disponibilidade de relatórios (Leonardo) | RELATORIOS / VISITAS; soma; ≥ 95%; peso 10 | jan 15/15; fev 10/10 | 100%; atendimento **100%** (teto); 10,00 pts | 10,53 pts (sem teto) |
| CT-12 | Engajamento (Julia) | Mãe com 5 submetas × 20%; proporcional; peso 10 | Atendimentos: 99,54% / 100% (Turnover, suposto) / 100% / 0% / 100% | 79,91%; 7,99 pts | 0,796 bruto (soma de grandezas diferentes) |

### 12.2 Regras gerais

| ID | Regra | Cenário | Esperado |
| --- | --- | --- | --- |
| CT-13 | Mês vazio (RN-08) | Média; jan 2, fev vazio, mar 4 | 3,00 (não 2,00) |
| CT-14 | Divisão por zero (RN-18) | CHECKLISTS / PROC_CRITICOS com PROC_CRITICOS = 0 no mês | Resultado do mês vazio + aviso; acumulado ignora o mês |
| CT-15 | Meta corporativa (RN-05) | Saldo em caixa atribuída à Julia (peso 15) e a outro gestor (peso 10); um lançamento | Mesmo atendimento A para os dois; pontos 15 × A e 10 × A |
| CT-16 | Objetivo mensal e período (RN-13, RN-15) | Meta jul–dez, objetivo jul 50% … dez 100%; lançamentos de jan a jun existem; acumulado jul–dez 80% | Jan–jun ignorados (histórico); compara com 100% (dez); atendimento 80% |
| CT-17 | Pesos (RN-03) | Gestor sem corporativas com departamentais somando 90 | Alerta de consistência; ciclo não ativa |
| CT-18 | Fechamento (RN-34, RN-36) | Outubro/2026; feriados 02/11 e 20/11 | Aceita até 24/11/2026 23h59; em 25/11 00h00 recusa com MES_FECHADO; com reabertura até 27/11, aceita e liga o valor à reabertura |

## 13. Plano de fases e cronograma

Com um desenvolvedor, a Fase 1 se divide em duas entregas. A **1a** (até 22/01/2027) coloca os gestores lançando janeiro. A **1b** (até 12/02/2027) completa a Fase 1 antes do primeiro fechamento real. Janeiro/2027 fecha no 15º dia útil de fevereiro: 19/02, ou 23/02 se a empresa folgar na segunda e na terça de Carnaval (08 e 09/02). Os itens mais trabalhosos e sem prazo forçado (importação, carga histórica, catálogo) ficaram na 1b. Premissas: dedicação integral ao projeto, recesso de 24/12 a 03/01 e Administrador disponível para validar uma vez por semana.

### 13.1 Pré-requisitos da TI (disponíveis)

- Servidor Windows Server (sugestão: 4 vCPU, 16 GB RAM, 150 GB em disco separado para dados) com IIS, URL Rewrite e ARR.
- PostgreSQL 16 instalado (no mesmo servidor ou em outro), com rotina de backup.
- Nome DNS interno e certificado HTTPS confiável em celulares (seção 8.4).
- Registro do aplicativo no Entra ID (SPA + escopo da API).
- Fase 2: caixa de e-mail de serviço com permissão Mail.Send pelo Microsoft Graph, ou relay SMTP.

### 13.2 Fase 1 (desenvolvimento)

| Etapa | Período | Passos (CLAUDE.md) | Entregas |
| --- | --- | --- | --- |
| 1 | 16/11–04/12 (3 sem.) | P01–P11 | Monorepo, CI e homologação; login Entra ID ponta a ponta; schema base; parser de fórmulas, motor de cálculo e calendário passando nos 18 casos da seção 12; cadastros básicos (usuários, setores, ciclos, feriados, responsáveis) |
| 2 | 07/12–23/12 (2,5 sem.) | P12–P16 | Variáveis, metas, submetas, objetivos mensais e atribuições; editor de fórmula com teste; painel de consistência. **Produção instalada**: o Administrador já pode cadastrar as metas de 2027 |
| — | 24/12–03/01 | — | Recesso. O Administrador pode seguir cadastrando metas |
| 3 | 04/01–22/01 (3 sem.) | P17–P21 | Lançamentos (tela responsiva, API, trava por dias úteis, histórico, concorrência); recálculo por eventos; Minhas metas com memória de cálculo. **Entrega 1a** e treinamento de 1 hora com os 7 gestores |
| 4 | 25/01–12/02 (3 sem.) | P22–P28 | Jobs, reabertura, importação Excel, carga histórica, catálogo de modelos, Visão geral, exportação, schema bi. **Entrega 1b**. Administrador carrega os dados de 2026 |
| — | 15/02–19/02 | — | Folga para ajustes antes do 1º fechamento real (janeiro/2027) |

### 13.3 Fase 2 (1º trimestre de 2027)

| Bloco | Esforço estimado (1 desenvolvedor) |
| --- | --- |
| Pedido de correção com aprovação do Gerente Geral + e-mails (lembretes, pendências, decisões) | 2 semanas |
| Evidências e comentários | 1 semana |
| Avaliação de comportamentos (cadastros, formulário, resultados, ligação com "Modelo de liderança") | 2 a 3 semanas |
| Cópia de ciclo, ANTERIOR() e META() nas fórmulas | 1 semana |
| Dashboard nativo (após receber o layout) | 2 a 3 semanas |

Total de 8 a 10 semanas, de março a maio de 2027. A ordem pode mudar conforme a prioridade do negócio.

### 13.4 Fase 3 (a definir)

Integrações com ERP e com as planilhas do SharePoint (custos de visitas, controle de orçamentos), substituindo importações manuais; notificações no Teams.

### 13.5 Desenvolvimento com o Claude Code

O desenvolvimento é feito por um desenvolvedor com o Claude Code, guiado pelo arquivo CLAUDE.md na raiz do repositório. Ele resume as regras deste documento e divide o trabalho em 34 passos (P01–P28 na Fase 1, P29–P34 na Fase 2), cada um com tarefas e critérios de aceite.

- Este documento é exportado em Markdown para docs/especificacao.md e é a fonte completa das regras. Se o CLAUDE.md e este documento divergirem, o Claude Code para e pergunta.
- Um passo por sessão: o Claude Code apresenta um plano curto, implementa, roda pnpm verify (lint, tipos e testes), confere os critérios de aceite, registra o progresso e propõe o commit, que só é feito com autorização.
- Comandos destrutivos (apagar banco, reset de migrações, push forçado) sempre pedem confirmação. Migrações aplicadas não são editadas.
- Decisões técnicas fora deste documento (bibliotecas, versões, desvios aprovados) ficam em docs/decisoes.md. Quando uma decisão mudar uma regra, este documento também é atualizado.

## 14. Riscos, decisões e pendências

### 14.1 Riscos

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Um único desenvolvedor | Prazo depende de uma pessoa; férias ou outra demanda param o projeto | Fase 1 dividida em 1a e 1b; motor de cálculo isolado e coberto por testes; README de instalação e decisões registradas neste documento |
| Prazo curto, com recesso de fim de ano | Entrega 1a atrasar | Escopo da 1a reduzido ao essencial para lançar; 1º fechamento real só em 19/02 |
| Cadastro das metas 2027 depender do Administrador | Sistema pronto sem metas | Produção instalada no fim da etapa 2 (23/12), para o cadastro começar antes do recesso |
| Erros de regra herdados das planilhas | Notas erradas no sistema novo | O Administrador corrige pelo cadastro de metas; prévia e memória de cálculo mostram o efeito antes de valer (seção 14.3) |
| Baixa adesão dos gestores | Lançamentos atrasados | Tela de lançamento pensada para celular; lembretes na Fase 2; treinamento curto |
| Expectativa de Power BI sem licença | Dashboard sem forma de compartilhar | Dashboard nativo na Fase 2 (seção 8.6) |

### 14.2 Decisões registradas

| Tema | Decisão |
| --- | --- |
| Nome do sistema | Sugestão: Prumo ECTAS (a confirmar) |
| Perfis | Administrador, Diretoria, Gestor, Leitor; Gerente Geral aprova correções |
| Cadastro de metas | Só o Administrador, sem aprovação; regras erradas são corrigidas por ele no cadastro |
| Responsabilidade | Um responsável por meta; sem substitutos |
| Porte atual | 7 gestores, 17 setores + Corporativo |
| Login | Conta Microsoft da empresa |
| Nota | 50% Corporativo + 50% Departamental; sem corporativas, Departamental = 100%; pesos departamentais somam juntos |
| Metas corporativas | Um lançamento para a empresa, feito pelo gestor responsável pela meta |
| Submetas | 2 níveis; mãe pode ter variáveis próprias; mãe batida com soma ponderada = 100%; Engajamento = 5 × 20% |
| Catálogo | Modelos reutilizáveis, com peso e objetivo por gestor |
| Período e objetivo | Ciclo jan–dez; metas podem ter período próprio; fora do período = histórico; objetivo pode variar por mês; nota usa o objetivo do último mês |
| Variáveis | Acumulação por variável; tipos número, %, R$, dias, horas, SIM/NÃO; vazio ≠ zero; compartilháveis; pertencem ao setor |
| Pontuação | Tudo ou nada ou proporcional, por meta; teto de 100%; sem faixas; 2 casas decimais |
| Fechamento | 15 dias úteis a partir do 1º dia útil do mês seguinte; calendário de Joinville mantido pela empresa |
| Reabertura | Só o Administrador, com autorização do Gerente Geral combinada fora do sistema e motivo registrado |
| Correção em mês fechado | Pedido com aprovação; valor anterior preservado |
| Evidências | Anexos de até 10 MB e comentários |
| Dados 2026 | Lançados pelo Administrador como carga histórica |
| Integrações | Importação Excel na Fase 1 |
| Comportamentos | Entra no sistema; só avaliação do gestor; 32 comportamentos, notas de 1 a 5, 3 momentos |
| Dashboard | Centralizado no sistema; sem licença Power BI Pro |
| Tecnologia | Node.js + React + PostgreSQL em servidor Windows interno; acesso só pela rede interna |
| Infraestrutura | Servidor, certificado HTTPS e registro no Entra ID já disponíveis |
| Equipe | Um desenvolvedor, com o Claude Code guiado pelo CLAUDE.md |
| Entregas | 1a em 22/01/2027; 1b em 12/02/2027; Fase 2 de março a maio/2027 |
| Remuneração | A nota não afeta remuneração |
| Dispositivos | Celular, tablet, notebook e desktop |

### 14.3 Pendências do negócio (revisar antes de cadastrar as metas)

Não bloqueiam o desenvolvimento: o Administrador corrige cada regra pelo cadastro de metas. A lista serve de checklist ao cadastrar as metas de 2026 e 2027 no sistema.

- ☐ **Turnover depto:** a fórmula é (admissões + demissões) ÷ 2 ÷ colaboradores, ou admissões + demissões ÷ 2? As duas aparecem na planilha da Julia. O operador "≥ 10%" parece invertido (deveria ser ≤).
- ☐ **Retrabalho de NFs:** o objetivo "≥ 105%" deveria ser "≤ 5%"?
- ☐ **Acidentes sem afastamento:** a fórmula calcula a fração de dias **com** afastamento, e o objetivo é "= 0". Confirmar fórmula e operador.
- ☐ **Tempo de fechamento de vagas:** o objetivo é "= 1", mas o resultado está em dias (38). Definir o objetivo em dias com "≤".
- ☐ **Índice de Eficiência Operacional:** a métrica fala em entradas ÷ saídas, mas a meta é composta pelos projetos Comitê de Investimento e DRE. Qual é a meta correta?
- ☐ **Saldo em caixa:** a planilha da Julia usa (entradas − saldo) ÷ saldo e as outras usam saldo ÷ entradas. Os valores mensais já vêm acumulados ("acc") ou são do mês?
- ☐ **Acuracidade de inventário:** a fórmula usa sistema ÷ físico, mas a métrica diz físico ÷ sistema.
- ☐ **Aderência aos vencimentos (Recebimento e Pagamentos):** confirmar a faixa (± 5 dias) e a regra de acumulação das médias.
- ☐ **Check lists da Fábrica e do PCPM:** a quantidade de processos críticos está zerada em quase todos os meses; preencher como "último valor".
- ☐ **Modelo de liderança (Evandro):** a fórmula espera "SIM", mas o valor é uma nota média; usar a regra da RN-43.

### 14.4 Próximos passos

1. Exportar este documento em Markdown para docs/especificacao.md e colocar o CLAUDE.md na raiz do repositório.
2. Iniciar a etapa 1 em 16/11 pelo passo P01 (monorepo), seguindo até o P11.
3. Confirmar o nome do sistema.
4. O Administrador usa a lista da 14.3 ao cadastrar as metas, a partir de 23/12.
5. Enviar o layout do dashboard para detalhar a Fase 2 (passo P34).
