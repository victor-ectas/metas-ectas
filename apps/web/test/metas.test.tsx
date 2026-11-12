import type { Ciclo, Meta, ResponsavelSetor, Setor, Submeta, Variavel } from '@metas/tipos';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderizarApp, type Resposta, sessaoDe } from './utilitarios';

const CICLO: Ciclo = {
  id: '44444444-4444-4444-8444-444444444444',
  ano: 2027,
  status: 'RASCUNHO',
  encerradoEm: null,
};
const FISCAL: Setor = {
  id: '22222222-2222-4222-8222-222222222222',
  codigo: 'FISCAL',
  nome: 'Fiscal',
  corporativo: false,
  ativo: true,
};
const JULIA = '11111111-1111-4111-8111-111111111111';
const META_ID = '33333333-3333-4333-8333-333333333333';

const variavel = (codigo: string, id: string, tipo: Variavel['tipo'] = 'NUMERO'): Variavel => ({
  id,
  cicloId: CICLO.id,
  setorId: FISCAL.id,
  setorCodigo: 'FISCAL',
  setorNome: 'Fiscal',
  codigo,
  nome: `Variável ${codigo}`,
  tipo,
  acumulacao: 'SOMA',
  origem: 'DIGITADA',
  responsavelId: null,
  responsavelNome: null,
  casasDecimais: 0,
  ativo: true,
  temLancamentos: false,
  usadaPor: [],
});

const VARIAVEIS = [
  variavel('REQ_ATENDIDOS', '55555555-5555-4555-8555-555555555551'),
  variavel('TOTAL_REQ', '55555555-5555-4555-8555-555555555552'),
  variavel('PRESENCAS', '55555555-5555-4555-8555-555555555553'),
];

const RESPONSAVEIS: ResponsavelSetor[] = [
  { setor: FISCAL, usuarioId: JULIA, usuarioNome: 'Julia Souza' },
];

const submeta = (codigo: string, peso: string, id: string): Submeta => ({
  id,
  codigo,
  indicador: `Indicador ${codigo}`,
  metrica: 'Presenças',
  unidade: 'NUMERO',
  formula: 'PRESENCAS',
  modoApuracao: 'SOMA_RESULTADOS',
  operador: 'GE',
  tolerancia: null,
  mesInicio: 1,
  mesFim: 12,
  objetivos: [{ mes: 0, valor: '10' }],
  pesoInterno: peso,
  ordem: 0,
  ativo: true,
  versao: 1,
  variaveis: [],
});

const meta = (alteracoes: Partial<Meta> = {}): Meta => ({
  id: META_ID,
  cicloId: CICLO.id,
  setorId: FISCAL.id,
  setorCodigo: 'FISCAL',
  setorNome: 'Fiscal',
  bloco: 'DEPARTAMENTAL',
  codigo: 'FISCAL_ENGAJ',
  indicador: 'Engajamento',
  metrica: 'Composição',
  unidade: 'PERCENTUAL',
  formula: null,
  modoApuracao: 'FORMULA_SOBRE_ACUMULADOS',
  operador: 'GE',
  tolerancia: null,
  mesInicio: 1,
  mesFim: 12,
  objetivos: [],
  regraPontuacao: 'PROPORCIONAL',
  pesoInterno: null,
  responsavelId: JULIA,
  responsavelNome: 'Julia Souza',
  ordem: 0,
  ativo: true,
  versao: 4,
  variaveis: [],
  atribuicoes: [{ id: META_ID, usuarioId: JULIA, usuarioNome: 'Julia Souza', peso: '10' }],
  submetas: [
    submeta('ENGAJ_1', '0.5', '66666666-6666-4666-8666-666666666661'),
    submeta('ENGAJ_2', '0.5', '66666666-6666-4666-8666-666666666662'),
  ],
  temLancamentos: false,
  ...alteracoes,
});

function abrir(caminho: string, respostas: Record<string, Resposta> = {}, largura = 1440) {
  return renderizarApp({
    caminho,
    largura,
    respostas: {
      '/me': { status: 200, corpo: sessaoDe('ADMIN') },
      '/ciclos': { status: 200, corpo: [CICLO] },
      '/setores': { status: 200, corpo: [FISCAL] },
      [`/ciclos/${CICLO.id}/variaveis`]: { status: 200, corpo: VARIAVEIS },
      [`/ciclos/${CICLO.id}/responsaveis`]: { status: 200, corpo: RESPONSAVEIS },
      '/usuarios': {
        status: 200,
        corpo: {
          itens: [
            {
              id: JULIA,
              nome: 'Julia Souza',
              email: 'julia@ectas.com.br',
              perfil: 'GESTOR',
              ativo: true,
              gerenteGeral: false,
              superiorId: null,
              superiorNome: null,
              entrouAlgumaVez: true,
              setoresLeitor: [],
            },
          ],
          total: 1,
          pagina: 1,
          tamanho: 200,
        },
      },
      ...respostas,
    },
  });
}

describe('lista de metas', () => {
  it('quem não é Administrador vê só um aviso', async () => {
    renderizarApp({
      caminho: '/metas',
      respostas: { '/me': { status: 200, corpo: sessaoDe('GESTOR') } },
    });
    expect(
      await screen.findByText('As metas são cadastradas pelo Administrador do sistema.'),
    ).toBeInTheDocument();
  });

  it('mostra as metas com submetas e peso; excluir só sem lançamentos', async () => {
    abrir('/metas', {
      [`GET /ciclos/${CICLO.id}/metas`]: {
        status: 200,
        corpo: [
          meta(),
          meta({
            id: '77777777-7777-4777-8777-777777777777',
            codigo: 'FISCAL_PRAZO',
            submetas: [],
            temLancamentos: true,
          }),
        ],
      },
    });
    expect(await screen.findByText('FISCAL_ENGAJ (2 submetas)')).toBeInTheDocument();
    expect(screen.getAllByText('10,00 pts')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Excluir FISCAL_ENGAJ' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Excluir FISCAL_PRAZO' })).not.toBeInTheDocument();
  });
});

describe('editor: nova meta (CT-01)', () => {
  it('passa pelas 5 etapas, testa a fórmula e envia o corpo certo', async () => {
    const u = userEvent.setup({ delay: null });
    const { chamadas } = abrir(`/metas/nova?ciclo=${CICLO.id}`, {
      [`POST /ciclos/${CICLO.id}/metas`]: {
        status: 201,
        corpo: meta({ codigo: 'FISCAL_PRAZO', submetas: [] }),
      },
      [`GET /ciclos/${CICLO.id}/metas`]: { status: 200, corpo: [] },
    });

    // 1. O que é: o responsável vem sugerido pelo setor.
    await u.click(await screen.findByRole('combobox', { name: /^Setor/ }));
    await u.click(screen.getByRole('option', { name: 'Fiscal' }));
    expect(await screen.findByText('É o responsável pelo setor no ciclo.')).toBeInTheDocument();
    await u.type(screen.getByLabelText(/^Indicador/), 'Requisições atendidas no prazo');
    await u.type(screen.getByLabelText(/^Código/), 'fiscal_prazo');
    await u.type(screen.getByLabelText(/^Como é medida/), 'Atendidas / total');

    // 3. Fórmula, com o teste de valores pelo motor no navegador.
    await u.click(screen.getByRole('tab', { name: /Fórmula/ }));
    await u.type(screen.getByRole('textbox', { name: /^Fórmula/ }), 'REQ_ATENDIDOS / TOTAL_REQ');
    expect(
      await screen.findByText(/Fórmula válida: usa REQ_ATENDIDOS, TOTAL_REQ/),
    ).toBeInTheDocument();
    await u.type(screen.getByLabelText('REQ_ATENDIDOS'), '16');
    await u.type(screen.getByLabelText('TOTAL_REQ'), '20');
    expect(screen.getByText('Resultado: 80,00%')).toBeInTheDocument();

    // 5. Objetivo e pontuação.
    await u.click(screen.getByRole('tab', { name: /Objetivo e pontuação/ }));
    await u.type(screen.getByRole('textbox', { name: /^Objetivo/ }), '80');
    await u.click(screen.getByLabelText(/^Proporcional ao atendimento/));
    await u.type(screen.getByLabelText(/^Peso \(pontos\)/), '10');

    const resumo = screen.getByRole('complementary', { name: 'Resumo da meta' });
    expect(within(resumo).getByText(/for maior ou igual a 80,00%\.$/)).toBeInTheDocument();
    expect(
      within(resumo).getByText('Vale 10,00 pontos para Julia Souza, proporcional ao atendimento.'),
    ).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'Cadastrar meta' }));
    await waitFor(() => {
      expect(chamadas.find((c) => c.metodo === 'POST')?.corpo).toEqual({
        setorId: FISCAL.id,
        codigo: 'FISCAL_PRAZO',
        indicador: 'Requisições atendidas no prazo',
        metrica: 'Atendidas / total',
        unidade: 'PERCENTUAL',
        formula: 'REQ_ATENDIDOS / TOTAL_REQ',
        modoApuracao: 'FORMULA_SOBRE_ACUMULADOS',
        operador: 'GE',
        tolerancia: null,
        mesInicio: 1,
        mesFim: 12,
        objetivos: [{ mes: 0, valor: '0.8' }],
        ativo: true,
        regraPontuacao: 'PROPORCIONAL',
        pesoInterno: null,
        responsavelId: JULIA,
        ordem: 0,
        atribuicoes: [{ usuarioId: JULIA, peso: '10' }],
        submetas: [],
      });
    });
    expect(await screen.findByText('Meta FISCAL_PRAZO cadastrada.')).toBeInTheDocument();
    // Fluxo longo de propósito (as 5 etapas): mais tempo que o padrão.
  }, 20_000);

  it('erro de fórmula aparece ao vivo, em português e com a posição', async () => {
    const u = userEvent.setup();
    abrir(`/metas/nova?ciclo=${CICLO.id}`);
    await u.click(await screen.findByRole('combobox', { name: /^Setor/ }));
    await u.click(screen.getByRole('option', { name: 'Fiscal' }));
    await u.click(screen.getByRole('tab', { name: /Fórmula/ }));
    await u.type(screen.getByRole('textbox', { name: /^Fórmula/ }), 'TOTAL / 2');
    expect(await screen.findByText('Variável desconhecida: TOTAL')).toBeInTheDocument();
  });

  it('erros do navegador antes de enviar (campos obrigatórios)', async () => {
    const u = userEvent.setup();
    const { chamadas } = abrir(`/metas/nova?ciclo=${CICLO.id}`);
    await u.click(await screen.findByRole('button', { name: 'Cadastrar meta' }));
    expect(await screen.findByText(/Indicador: /)).toBeInTheDocument();
    expect(chamadas.some((c) => c.metodo === 'POST')).toBe(false);
  });
});

describe('editor: meta com submetas', () => {
  it('soma dos pesos internos ao vivo, PUT com a versão lida e volta à lista', async () => {
    const u = userEvent.setup();
    const { chamadas } = abrir(`/metas/${META_ID}`, {
      // Depois do PUT, a meta recarrega com a versão nova: o editor é remontado e, mesmo assim,
      // precisa voltar para a lista (regressão: os callbacks de `mutate` se perdiam).
      [`GET /metas/${META_ID}`]: () => ({
        status: 200,
        corpo: meta({ versao: chamadas.some((c) => c.metodo === 'PUT') ? 5 : 4 }),
      }),
      [`PUT /metas/${META_ID}`]: { status: 200, corpo: meta({ versao: 5 }) },
      [`GET /ciclos/${CICLO.id}/metas`]: { status: 200, corpo: [] },
      // A recarga das variáveis demora mais que a da meta, como no navegador.
      [`GET /ciclos/${CICLO.id}/variaveis`]: () =>
        new Promise((resolver) => {
          setTimeout(() => {
            resolver({ status: 200, corpo: VARIAVEIS });
          }, 30);
        }),
    });
    expect(await screen.findByText('Pesos internos: 100,00% de 100,00%.')).toBeInTheDocument();
    expect(screen.getByText(/atendimento composto das submetas/)).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'ENGAJ_2 (50%)' }));
    await u.click(screen.getByRole('tab', { name: /Objetivo e pontuação/ }));
    const peso = screen.getByLabelText(/^Peso interno/);
    await u.clear(peso);
    await u.type(peso, '40');
    expect(
      screen.getByText('Pesos internos: 90,00% de 100,00%. Faltam 10,00%.'),
    ).toBeInTheDocument();
    await u.clear(peso);
    await u.type(peso, '50');

    await u.click(screen.getByRole('button', { name: 'Salvar meta' }));
    await waitFor(() => {
      const put = chamadas.find((c) => c.metodo === 'PUT')?.corpo as {
        versao: number;
        meta: { formula: unknown; submetas: { id?: string; pesoInterno: string }[] };
      };
      expect(put.versao).toBe(4);
      expect(put.meta.formula).toBeNull();
      expect(put.meta.submetas.map((s) => [s.id, s.pesoInterno])).toEqual([
        ['66666666-6666-4666-8666-666666666661', '0.5'],
        ['66666666-6666-4666-8666-666666666662', '0.5'],
      ]);
    });
    expect(await screen.findByText('Meta FISCAL_ENGAJ salva.')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Metas' })).toBeInTheDocument();
  });

  it('mostra os erros da API (fórmula de uma submeta) e o conflito de versão', async () => {
    const u = userEvent.setup();
    abrir(`/metas/${META_ID}`, {
      [`GET /metas/${META_ID}`]: { status: 200, corpo: meta() },
      [`PUT /metas/${META_ID}`]: {
        status: 409,
        corpo: {
          codigo: 'CONFLITO_VERSAO',
          mensagem: 'Esta meta foi alterada por outra pessoa enquanto você editava.',
          detalhes: { versaoAtual: 5 },
        },
      },
    });
    await u.click(await screen.findByRole('button', { name: 'Salvar meta' }));
    expect(await screen.findByText(/alterada por outra pessoa/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recarregar a versão atual' })).toBeInTheDocument();
  });

  it('no tablet as etapas viram "Etapa X de 5"', async () => {
    abrir(`/metas/${META_ID}`, { [`GET /metas/${META_ID}`]: { status: 200, corpo: meta() } }, 768);
    expect(await screen.findByText('Etapa 1 de 5: O que é')).toBeInTheDocument();
  });
});
