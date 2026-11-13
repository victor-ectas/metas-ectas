import type { LancamentosMes, MesLancamento, VariavelLancamento } from '@metas/tipos';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { type ChamadaFalsa, renderizarApp, type Resposta, sessaoDe } from './utilitarios';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const CICLO = id(99);
const ano = (valores: Record<number, string>) =>
  Array.from({ length: 12 }, (_, i) => valores[i + 1] ?? null);

const meses = (fechados: number[] = [1]): MesLancamento[] =>
  Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1;
    const status = fechados.includes(mes) ? 'FECHADO' : mes <= 3 ? 'ABERTO' : 'FUTURO';
    return {
      mes,
      status,
      fechaEm: `2027-${String(mes + 1).padStart(2, '0')}-22T02:59:59.999Z`,
      diasUteisRestantes: status === 'ABERTO' ? 9 : null,
      pendentes: status === 'ABERTO' ? 2 : 0,
    };
  });

function variavel(n: number, alteracoes: Partial<VariavelLancamento>): VariavelLancamento {
  return {
    id: id(n),
    setorId: id(50),
    setorCodigo: 'FISCAL',
    setorNome: 'Fiscal',
    codigo: `V${String(n)}`,
    nome: `Variável ${String(n)}`,
    tipo: 'NUMERO',
    acumulacao: 'SOMA',
    casasDecimais: 0,
    editavel: true,
    status: 'ABERTO',
    valor: null,
    versao: 0,
    origem: null,
    atualizadoEm: null,
    valoresAno: ano({}),
    ...alteracoes,
  };
}

/** CT-01 em fevereiro/2027, com janeiro 16/20 já gravado. */
function dados(mes = 2, alteracoes: Partial<LancamentosMes> = {}): LancamentosMes {
  const status = mes === 1 ? 'FECHADO' : 'ABERTO';
  return {
    ciclo: { id: CICLO, ano: 2027, status: 'ATIVO' },
    mes,
    status,
    fechaEm: '2027-03-22T02:59:59.999Z',
    meses: meses(),
    cargaHistorica: false,
    variaveis: [
      variavel(1, {
        codigo: 'REQ_ATENDIDOS',
        nome: 'Requisições atendidas',
        status,
        valor: mes === 1 ? '16' : null,
        versao: mes === 1 ? 1 : 0,
        valoresAno: ano({ 1: '16' }),
      }),
      variavel(2, {
        codigo: 'TOTAL_REQ',
        nome: 'Total de requisições',
        status,
        valor: mes === 1 ? '20' : null,
        versao: mes === 1 ? 1 : 0,
        valoresAno: ano({ 1: '20' }),
      }),
      variavel(3, { codigo: 'IMPLANTADO', nome: 'Sistema implantado', tipo: 'SIM_NAO', status }),
    ],
    metas: [
      {
        id: id(10),
        codigo: 'FISCAL_PRAZO',
        indicador: 'Requisições no prazo',
        unidade: 'PERCENTUAL',
        formula: 'REQ_ATENDIDOS / TOTAL_REQ',
        modoApuracao: 'FORMULA_SOBRE_ACUMULADOS',
        operador: 'GE',
        tolerancia: null,
        mesInicio: 1,
        mesFim: 12,
        objetivos: [{ mes: 0, valor: '0.8' }],
        pesoInterno: null,
        variaveis: { REQ_ATENDIDOS: id(1), TOTAL_REQ: id(2) },
        setorNome: 'Fiscal',
        regraPontuacao: 'PROPORCIONAL',
        submetas: [],
      },
    ],
    ...alteracoes,
  };
}

function abrir(respostas: Record<string, Resposta> = {}, largura = 1440) {
  return renderizarApp({
    caminho: '/lancamentos',
    largura,
    respostas: {
      '/me': { status: 200, corpo: sessaoDe('GESTOR') },
      '/lancamentos': (chamada: ChamadaFalsa) => {
        const mes = Number(new URL(chamada.url).searchParams.get('mes') ?? '2');
        return { status: 200, corpo: dados(mes) };
      },
      ...respostas,
    },
  });
}

const campo = (nome: string) => screen.getByRole('textbox', { name: nome });

describe('Lançamentos (P19)', () => {
  it('abre no mês com pendências, com o prazo e as variáveis agrupadas pela meta', async () => {
    abrir();
    expect(
      await screen.findByText('Fevereiro/2027 fecha em 21/03: faltam 9 dias úteis.'),
    ).toBeVisible();
    const meta = screen.getByRole('region', { name: 'Requisições no prazo' });
    expect(within(meta).getByRole('textbox', { name: 'Requisições atendidas' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Janeiro, fechado' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Abril, ainda não começou' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Fevereiro, aberto, 2 pendências' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('prévia: o resultado do mês e o acumulado mudam enquanto digita (CT-01)', async () => {
    const usuario = userEvent.setup();
    abrir();
    await screen.findByRole('region', { name: 'Requisições no prazo' });
    const previa = screen.getByRole('group', { name: 'Prévia de Requisições no prazo' });
    // Só janeiro: 16/20 = 80%.
    expect(within(previa).getByText('Acumulado').nextSibling).toHaveTextContent('80,00%');

    await usuario.type(campo('Requisições atendidas'), '10');
    await usuario.type(campo('Total de requisições'), '25');
    expect(within(previa).getByText('Resultado do mês').nextSibling).toHaveTextContent('40,00%');
    expect(within(previa).getByText('Acumulado').nextSibling).toHaveTextContent('57,78%');
    expect(within(previa).getByText('Abaixo')).toBeVisible();

    await usuario.clear(campo('Requisições atendidas'));
    await usuario.type(campo('Requisições atendidas'), '20');
    expect(within(previa).getByText('Resultado do mês').nextSibling).toHaveTextContent('80,00%');
    expect(within(previa).getByText('Batida')).toBeVisible();
  });

  it('salva só o que mudou, com a versão lida, e avisa', async () => {
    const usuario = userEvent.setup();
    const { chamadas } = abrir({
      'PUT /lancamentos': {
        status: 200,
        corpo: {
          gravados: 3,
          itens: [
            { variavelId: id(1), mes: 2, valor: '20', versao: 1 },
            { variavelId: id(2), mes: 2, valor: '25', versao: 1 },
            { variavelId: id(3), mes: 2, valor: '1', versao: 1 },
          ],
        },
      },
    });
    await screen.findByRole('region', { name: 'Requisições no prazo' });
    await usuario.type(campo('Requisições atendidas'), '20');
    await usuario.type(campo('Total de requisições'), '25');
    await usuario.click(screen.getByRole('button', { name: 'Sim' }));
    await usuario.click(screen.getByRole('button', { name: 'Salvar 3 valores' }));

    expect(await screen.findByText('3 valores salvos.')).toBeVisible();
    const put = chamadas.find((c) => c.metodo === 'PUT');
    expect(put?.corpo).toEqual({
      ciclo: CICLO,
      itens: [
        { variavelId: id(1), mes: 2, valor: '20', versao: 0 },
        { variavelId: id(2), mes: 2, valor: '25', versao: 0 },
        { variavelId: id(3), mes: 2, valor: '1', versao: 0 },
      ],
    });
    await waitFor(() => {
      expect(screen.queryByRole('region', { name: 'Salvar lançamentos' })).toBeNull();
    });
  });

  it('valor inválido aparece no campo e bloqueia o salvar', async () => {
    const usuario = userEvent.setup();
    abrir();
    await screen.findByRole('region', { name: 'Requisições no prazo' });
    await usuario.type(campo('Total de requisições'), '2,5');
    expect(screen.getByText('Use só números inteiros.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Salvar 1 valor' })).toBeDisabled();
    expect(screen.getByText('Corrija 1 valor inválido para salvar.')).toBeVisible();
  });

  it('conflito de versão: mostra o valor salvo e deixa escolher', async () => {
    const usuario = userEvent.setup();
    abrir({
      'PUT /lancamentos': {
        status: 409,
        corpo: {
          codigo: 'CONFLITO_VERSAO',
          mensagem: 'Um valor foi alterado por outra pessoa depois que você abriu a tela.',
          detalhes: {
            conflitos: [
              {
                variavelId: id(1),
                mes: 2,
                valorAtual: '21',
                versaoAtual: 1,
                atualizadoEm: '2027-02-10T13:00:00.000Z',
              },
            ],
          },
        },
      },
    });
    await screen.findByRole('region', { name: 'Requisições no prazo' });
    await usuario.type(campo('Requisições atendidas'), '20');
    await usuario.click(screen.getByRole('button', { name: 'Salvar 1 valor' }));

    expect(await screen.findByText(/Outra pessoa salvou 21,00 em 10\/02\/2027/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Salvar 1 valor' })).toBeDisabled();
    await usuario.click(screen.getByRole('button', { name: 'Manter o meu' }));
    expect(screen.getByRole('button', { name: 'Salvar 1 valor' })).toBeEnabled();
  });

  it('mês fechado: campos travados, com cadeado e o caminho da reabertura', async () => {
    const usuario = userEvent.setup();
    abrir();
    await screen.findByRole('region', { name: 'Requisições no prazo' });
    await usuario.click(screen.getByRole('button', { name: 'Janeiro, fechado' }));
    expect(
      await screen.findByText(/Janeiro\/2027 fechou em .*peça a reabertura ao Administrador/),
    ).toBeVisible();
    expect(campo('Requisições atendidas')).toBeDisabled();
    expect(campo('Requisições atendidas')).toHaveValue('16');
  });

  it('trocar de mês com valores não salvos pede confirmação', async () => {
    const usuario = userEvent.setup();
    abrir();
    await screen.findByRole('region', { name: 'Requisições no prazo' });
    await usuario.type(campo('Requisições atendidas'), '20');
    await usuario.click(screen.getByRole('button', { name: 'Março, aberto, 2 pendências' }));
    const dialogo = screen.getByRole('dialog', { name: 'Descartar o que não foi salvo?' });
    await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    // O diálogo fecha com animação; até lá, o resto da tela fica oculto para leitores de tela.
    await waitFor(() => {
      expect(campo('Requisições atendidas')).toHaveValue('20');
    });
  });

  it('no celular (360 px): meses em duas linhas e campos de toque grandes', async () => {
    abrir({}, 360);
    await screen.findByRole('region', { name: 'Requisições no prazo' });
    const grupo = screen.getByRole('group', { name: 'Mês' });
    expect(within(grupo).getAllByRole('button')).toHaveLength(12);
    expect(campo('Requisições atendidas')).toHaveAttribute('inputmode', 'decimal');
  });

  it('sem ciclo ativo: aviso, sem erro', async () => {
    renderizarApp({
      caminho: '/lancamentos',
      respostas: {
        '/me': { status: 200, corpo: sessaoDe('GESTOR') },
        '/lancamentos': {
          status: 404,
          corpo: {
            codigo: 'NAO_ENCONTRADO',
            mensagem: 'Não há ciclo ativo para lançamento.',
            detalhes: {},
          },
        },
      },
    });
    expect(await screen.findByText('Não há ciclo ativo para lançamento.')).toBeVisible();
  });
});
