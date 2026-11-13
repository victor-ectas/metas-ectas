# Treinamento dos gestores — Entrega 1a

Roteiro de **1 hora** para apresentar o sistema aos 7 gestores antes de lançarem janeiro/2027. Quem conduz é o Administrador (ou o desenvolvedor). Os gestores acompanham no próprio celular.

**Objetivo:** ao sair da sala, cada gestor consegue entrar, lançar os valores do mês, conferir a nota e sabe até quando pode lançar.

## Antes do treinamento

Faça isto até o dia anterior:

- [ ] O sistema está instalado em produção e abre pelo celular na rede interna (Wi-Fi da empresa).
- [ ] Cada gestor está cadastrado com o e-mail da empresa, perfil **Gestor**, **ativo**.
- [ ] O ciclo 2027 está **ativo** (Ciclos e consistência sem problemas que bloqueiam).
- [ ] Cada gestor é responsável pelos seus setores em 2027, e as metas de cada um estão cadastradas com os pesos certos.
- [ ] Os feriados de 2027 de Joinville estão cadastrados. Sem eles, o prazo de fechamento sai errado.
- [ ] Teste o login com uma conta de gestor (ou peça a um gestor para testar).
- [ ] Tenha à mão, para projetar: o sistema aberto como um gestor de exemplo e a planilha antiga de um gestor, para comparar.
- [ ] Combine com a TI: Wi-Fi da sala e projetor.

Janeiro/2027 aceita lançamento desde 1º/01 e fecha no 15º dia útil de fevereiro: **19/02/2027**, ou 23/02 se o Carnaval (08 e 09/02) estiver cadastrado como feriado. Esse é o primeiro fechamento real. Se o treinamento for em janeiro, os gestores já podem lançar valores de verdade no fim da sessão.

## Roteiro (60 minutos)

### 1. Por que mudar (5 min)

- O sistema substitui as planilhas de metas: um lugar só, cálculo igual para todos, sem fórmula quebrada nem versão perdida.
- O que **não muda**: as metas, os pesos e as fórmulas são os mesmos das planilhas. Quem cadastra é o Administrador.
- O que muda para o gestor: em vez de preencher a planilha, ele lança os valores do mês no sistema, pelo celular ou pelo computador.

### 2. Entrar (5 min)

Todos fazem juntos, no celular:

1. Abrir o endereço do sistema (deixe escrito no quadro). Sugira **adicionar à tela inicial**.
2. Entrar com a **conta Microsoft da empresa**, a mesma do e-mail.
3. Conferir no Início: "Olá, _nome_", o perfil **Gestor** e os seus setores.

Se aparecer "Seu acesso ainda não foi liberado", o Administrador ativa a conta na hora (Cadastros > Usuários).

### 3. O Início (5 min)

Projete o Início de um gestor de exemplo:

- **Pendências:** meses que já terminaram e ainda aceitam lançamento, com quantas variáveis faltam e o prazo ("Fecha em 19/02: faltam 4 dias úteis"). O mês corrente não aparece aqui, porque ainda está em andamento. O botão **Lançar** leva direto ao mês.
- **Nota parcial:** a soma dos pontos até agora, de 100, e quanto veio de cada bloco (Corporativo e Departamental).

### 4. Lançar o mês (20 min)

É a parte principal. Mostre no telão e depois cada um faz no celular.

1. **Escolher o mês.** Os meses aparecem no alto:
   - **aberto:** dá para lançar; o ponto azul indica que falta algo;
   - **com cadeado:** fechado, só leitura;
   - **tracejado:** ainda não começou.
2. **O prazo.** Embaixo dos meses aparece até quando o mês aceita valores: o **15º dia útil do mês seguinte, até 23h59**. Exemplo: janeiro/2027 fecha em 19/02/2027. Depois disso, só o Administrador reabre, com motivo.
3. **Os valores.** As variáveis vêm agrupadas por meta. Uma variável usada em duas metas aparece uma vez só.
   - Número com **vírgula** (`12,5`), como no Excel.
   - Percentual de **0 a 100** (`85` para 85%).
   - SIM/NÃO em botões.
   - **Vazio não é zero.** Deixe vazio o que ainda não sabe; zero só se o valor for zero mesmo. Vazio não entra na conta, zero entra.
4. **A prévia.** Enquanto digita, o cartão de cada meta mostra o resultado do mês e o acumulado do ano, com a situação (Batida, Abaixo…). Compare com a planilha antiga: o número deve ser o mesmo.
5. **Salvar.** O botão fica embaixo ("Salvar 3 valores"). Nada é gravado antes disso. Se trocar de mês sem salvar, o sistema avisa.
6. **Se duas pessoas mexerem ao mesmo tempo**, o sistema mostra o valor que a outra pessoa salvou e pergunta qual fica ("Usar o salvo" ou "Manter o meu").

**Exercício (5 min, dentro dos 20):** cada gestor abre o mês aberto, digita um valor numa variável, confere a prévia e salva. Se for treino, depois apaga o valor (deixa vazio) e salva de novo.

### 5. Minhas metas (10 min)

- **A nota** por bloco e o total.
- **A lista de metas:** acumulado, objetivo ("≥ 80,00%"), atendimento, pontos ("8,50 de 10") e situação. A situação sempre aparece escrita, não só na cor.
- **O detalhe de uma meta** (toque nela):
  - resultado mês a mês;
  - meses fora do período da meta aparecem como histórico e não contam na nota;
  - **Como foi calculado:** os valores de cada variável, o acumulado, a fórmula, o objetivo usado e a conta dos pontos. É aqui que o gestor confere se o sistema bate com a planilha.
- O seletor de ano mostra os anos já encerrados, com a nota final congelada.

### 6. Regras que geram dúvida (10 min)

| Pergunta                                        | Resposta                                                                                                             |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Até quando posso lançar?                        | Até 23h59 do 15º dia útil do mês seguinte, contando só dias úteis (segunda a sexta, sem feriados de Joinville).      |
| Perdi o prazo. E agora?                         | Peça a reabertura ao Administrador, com o motivo. Ele reabre por um prazo curto.                                     |
| Posso lançar o mês atual antes de acabar?       | Sim, o mês corrente já está aberto. O mês seguinte, não.                                                             |
| Errei um valor de um mês fechado.               | Só com reabertura (Administrador). Todo valor gravado fica no histórico, com quem e quando.                          |
| Passei da meta. Por que não ganhei mais pontos? | Atendimento e pontos têm teto: o máximo é o peso da meta.                                                            |
| A variável é de outro setor.                    | Ela aparece só para leitura; quem lança é o responsável pelo setor dela.                                             |
| Por que a nota mudou se eu não lancei nada?     | Uma meta corporativa ou uma variável compartilhada foi lançada pelo responsável dela, e o sistema recalcula na hora. |
| Posso importar do Excel?                        | Ainda não. A importação chega na próxima entrega (fevereiro).                                                        |

### 7. Perguntas e encerramento (5 min)

- Combine o prazo de janeiro: **19/02/2027** (confira na tela, depende dos feriados cadastrados).
- Diga a quem recorrer: o Administrador, por e-mail ou Teams, para acesso, reabertura ou dúvida de número.
- Peça que cada um lance janeiro **na primeira semana de fevereiro**, sem deixar para o último dia.

## Depois do treinamento

- [ ] Conferir em Cadastros > Usuários se todos entraram (quem não entrou ainda não tem o login ligado).
- [ ] Na semana do prazo, conferir quem ainda tem pendências. Os lembretes automáticos por e-mail chegam na Fase 2.
- [ ] Anotar as dúvidas que surgiram, para ajustar este roteiro e os textos das telas.
