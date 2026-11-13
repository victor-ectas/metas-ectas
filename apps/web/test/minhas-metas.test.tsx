import type {
  CicloResumo,
  MetaDoGestor,
  Pendencias,
  ResultadoMes,
  ResultadoMeta,
  ResultadosGestor,
} from '@metas/tipos';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { type ChamadaFalsa, erroJson, renderizarApp, type Resposta, sessaoDe } from './utilitarios';

/**
 * Minhas metas e Início do Gestor (P20). Os números são os dos casos de teste da seção 8.7 com
 * os resultados que a API grava (teste de integração do P17): CT-01 (80,00%, 10 pontos), CT-12
 * (mãe com 5 submetas, 79,91%, 7,99 pontos) e CT-15 (corporativa, 0,8 × 15 = 12 pontos).
 */

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const JULIA = sessaoDe('GESTOR').usuario.id;
const CALCULADO = '2027-02-10T12:00:00.000Z';
const C2027: CicloResumo = { id: id(97), ano: 2027, status: 'ATIVO' };
const C2026: CicloResumo = { id: id(96), ano: 2026, status: 'ENCERRADO' };

const acumulado = (
  valor: string | null,
  objetivo: string | null,
  atendimento: string,
  situacao: 'BATIDA' | 'ABAIXO',
) => ({ acumulado: valor, objetivo, atendimento, situacao, calculadoEm: CALCULADO });

const metaGestor = (alteracoes: Partial<MetaDoGestor>): MetaDoGestor => ({
  metaId: id(10),
  codigo: 'FISCAL_PRAZO',
  indicador: 'Requisições no prazo',
  unidade: 'PERCENTUAL',
  bloco: 'DEPARTAMENTAL',
  setorId: id(50),
  setorNome: 'Fiscal',
  operador: 'GE',
  tolerancia: null,
  regraPontuacao: 'PROPORCIONAL',
  peso: '10',
  pontos: '10',
  resultado: acumulado('0.8', '0.8', '1', 'BATIDA'),
  ...alteracoes,
});

function resultadosJulia(ciclo: CicloResumo = C2027): ResultadosGestor {
  return {
    ciclo,
    ciclos: [C2027, C2026],
    usuario: { id: JULIA, nome: 'Julia Martins Souza' },
    notas: {
      corporativo: { peso: '15', pontos: '12' },
      departamental: { peso: '20', pontos: '17.990741' },
      total: '29.990741',
      calculadoEm: CALCULADO,
    },
    metas: [
      metaGestor({
        metaId: id(15),
        codigo: 'CORP_ENTRADAS',
        indicador: 'Entradas de caixa',
        unidade: 'NUMERO',
        bloco: 'CORPORATIVO',
        setorNome: 'Corporativo',
        peso: '15',
        pontos: '12',
        resultado: acumulado('80', '100', '0.8', 'ABAIXO'),
      }),
      metaGestor({}),
      metaGestor({
        metaId: id(12),
        codigo: 'RH_ENGAJAMENTO',
        indicador: 'Engajamento',
        setorNome: 'RH',
        pontos: '7.990741',
        resultado: acumulado(null, null, '0.799074', 'ABAIXO'),
      }),
    ],
  };
}

const semMes = (mes: number, extra: Partial<ResultadoMes> = {}): ResultadoMes => ({
  mes,
  resultado: null,
  objetivo: '0.8',
  atendimento: null,
  situacao: 'SEM_DADOS',
  foraPeriodo: false,
  aviso: null,
  ...extra,
});

/** CT-01 como `GET /resultados/meta/{id}` devolve: jan 16/20, fev 20/25. */
function ct01(alteracoes: Partial<ResultadoMeta> = {}): ResultadoMeta {
  const bateu = { resultado: '0.8', atendimento: '1', situacao: 'BATIDA' as const };
  return {
    metaId: id(10),
    codigo: 'FISCAL_PRAZO',
    indicador: 'Requisições no prazo',
    unidade: 'PERCENTUAL',
    modoApuracao: 'FORMULA_SOBRE_ACUMULADOS',
    operador: 'GE',
    formula: 'REQ_ATENDIDOS / TOTAL_REQ',
    resultado: acumulado('0.8', '0.8', '1', 'BATIDA'),
    mensal: Array.from({ length: 12 }, (_, i) => (i < 2 ? semMes(i + 1, bateu) : semMes(i + 1))),
    memoria: {
      formula: 'REQ_ATENDIDOS / TOTAL_REQ',
      modoApuracao: 'FORMULA_SOBRE_ACUMULADOS',
      periodo: { mesInicio: 1, mesFim: 12 },
      variaveis: [
        {
          chave: 'REQ_ATENDIDOS',
          variavelId: id(1),
          acumulacao: 'SOMA',
          valores: Array.from({ length: 12 }, (_, i) => ({
            mes: i + 1,
            valor: ['16', '20'][i] ?? null,
          })),
          acumulado: '36',
        },
        {
          chave: 'TOTAL_REQ',
          variavelId: id(2),
          acumulacao: 'SOMA',
          valores: Array.from({ length: 12 }, (_, i) => ({
            mes: i + 1,
            valor: ['20', '25'][i] ?? null,
          })),
          acumulado: '45',
        },
      ],
      resultadosMensais: [],
      resultado: '0.8',
      objetivo: '0.8',
      mesObjetivo: 0,
      operador: 'GE',
      tolerancia: null,
      atendimento: '1',
      situacao: 'BATIDA',
      regraPontuacao: 'PROPORCIONAL',
      componentes: null,
      avisos: [],
    },
    variaveis: [
      { id: id(1), codigo: 'REQ_ATENDIDOS', nome: 'Requisições atendidas', tipo: 'NUMERO' },
      { id: id(2), codigo: 'TOTAL_REQ', nome: 'Total de requisições', tipo: 'NUMERO' },
    ],
    cicloId: C2027.id,
    ciclo: C2027,
    setorId: id(50),
    setorNome: 'Fiscal',
    bloco: 'DEPARTAMENTAL',
    regraPontuacao: 'PROPORCIONAL',
    ativo: true,
    submetas: [],
    atribuicoes: [
      { usuarioId: JULIA, usuarioNome: 'Julia Martins Souza', peso: '10', pontos: '10' },
    ],
    ...alteracoes,
  };
}

/** CT-12: mãe sem fórmula própria, 5 submetas de 20%. */
function ct12(): ResultadoMeta {
  const atendimentos = ['0.99537', '1', '1', '0', '1'];
  const nomes = ['Eventos', 'Rotatividade', 'Jornada', 'Projeto', 'Liderança'];
  const submetas = atendimentos.map((at, i) => ({
    ...ct01(),
    metaId: id(20 + i),
    codigo: `SUB_${String(i)}`,
    indicador: nomes[i] ?? '',
    resultado: acumulado('0.9', '0.9', at, at === '1' ? 'BATIDA' : 'ABAIXO'),
    pesoInterno: '0.2',
  }));
  const base = ct01();
  return {
    ...base,
    metaId: id(12),
    codigo: 'RH_ENGAJAMENTO',
    indicador: 'Engajamento',
    formula: null,
    setorNome: 'RH',
    resultado: acumulado(null, null, '0.799074', 'ABAIXO'),
    mensal: Array.from({ length: 12 }, (_, i) => semMes(i + 1, { objetivo: null, situacao: null })),
    memoria: {
      ...(base.memoria ?? ({} as never)),
      formula: null,
      variaveis: [],
      resultado: null,
      objetivo: null,
      mesObjetivo: null,
      atendimento: '0.799074',
      situacao: 'ABAIXO',
      componentes: submetas.map((s) => ({
        metaId: s.metaId,
        proprio: false,
        pesoInterno: '0.2',
        atendimento: s.resultado.atendimento,
      })),
    },
    variaveis: [],
    submetas,
    atribuicoes: [
      { usuarioId: JULIA, usuarioNome: 'Julia Martins Souza', peso: '10', pontos: '7.99074' },
    ],
  };
}

function abrir(caminho: string, respostas: Record<string, Resposta> = {}, largura = 1440) {
  return renderizarApp({
    caminho,
    largura,
    respostas: {
      '/me': { status: 200, corpo: sessaoDe('GESTOR') },
      [`/resultados/gestor/${JULIA}`]: (chamada: ChamadaFalsa) => {
        const ciclo = new URL(chamada.url).searchParams.get('ciclo');
        return {
          status: 200,
          corpo: resultadosJulia(ciclo === C2026.id ? C2026 : C2027),
        };
      },
      ...respostas,
    },
  });
}

/** Valor mostrado logo depois do rótulo ("Atendimento" → "100,00%"). */
const valorDe = (onde: HTMLElement, rotulo: string) =>
  within(onde).getByText(rotulo).nextSibling?.textContent;

describe('Minhas metas (P20)', () => {
  it('nota por bloco e total; metas com acumulado, objetivo, atendimento, pontos e situação', async () => {
    abrir('/minhas-metas');
    const nota = await screen.findByRole('region', { name: 'Nota parcial' });
    expect(nota).toHaveTextContent('29,99de 35 pontos');
    expect(nota).toHaveTextContent('Corporativo12,00 de 15');
    expect(nota).toHaveTextContent('Departamental17,99 de 20');
    expect(
      screen.getByText('Ciclo 2027. A nota é parcial: usa os meses lançados até agora.'),
    ).toBeVisible();

    const corporativo = screen.getByRole('region', { name: 'Corporativo' });
    const ct15 = within(corporativo).getByRole('link', { name: 'Entradas de caixa' });
    expect(valorDe(ct15, 'Acumulado')).toBe('80,00');
    expect(valorDe(ct15, 'Objetivo')).toBe('≥ 100,00');
    expect(valorDe(ct15, 'Atendimento')).toBe('80,00%');
    expect(valorDe(ct15, 'Pontos')).toBe('12,00 de 15');
    expect(within(ct15).getByText('Abaixo')).toBeVisible();

    const departamental = screen.getByRole('region', { name: 'Departamental' });
    const ct01 = within(departamental).getByRole('link', { name: 'Requisições no prazo' });
    expect(ct01).toHaveAttribute('href', `/minhas-metas/${id(10)}`);
    expect(valorDe(ct01, 'Acumulado')).toBe('80,00%');
    expect(valorDe(ct01, 'Objetivo')).toBe('≥ 80,00%');
    expect(valorDe(ct01, 'Atendimento')).toBe('100,00%');
    expect(valorDe(ct01, 'Pontos')).toBe('10,00 de 10');
    expect(within(ct01).getByText('Batida')).toBeVisible();

    const ct12 = within(departamental).getByRole('link', { name: 'Engajamento' });
    expect(valorDe(ct12, 'Atendimento')).toBe('79,91%');
    expect(valorDe(ct12, 'Pontos')).toBe('7,99 de 10');
  });

  it('seletor de ano: o ciclo encerrado mostra a nota final congelada', async () => {
    const usuario = userEvent.setup();
    const { chamadas } = abrir('/minhas-metas');
    await screen.findByRole('region', { name: 'Nota parcial' });
    await usuario.click(screen.getByRole('button', { name: '2026 (Encerrado)' }));
    expect(await screen.findByRole('region', { name: 'Nota final' })).toBeVisible();
    expect(screen.getByText('Ciclo 2026, encerrado: a nota final ficou congelada.')).toBeVisible();
    expect(chamadas.some((c) => c.url.endsWith(`?ciclo=${C2026.id}`))).toBe(true);
  });

  it('gestor ainda sem metas: aviso, sem erro', async () => {
    abrir('/minhas-metas', {
      [`/resultados/gestor/${JULIA}`]: {
        status: 200,
        corpo: {
          ciclo: null,
          ciclos: [],
          usuario: { id: JULIA, nome: 'Julia' },
          notas: null,
          metas: [],
        },
      },
    });
    expect(await screen.findByText(/Você ainda não tem metas num ciclo ativo/)).toBeVisible();
  });

  it('no celular (360 px): cada meta vira um cartão tocável', async () => {
    abrir('/minhas-metas', {}, 360);
    const meta = await screen.findByRole('link', { name: 'Requisições no prazo' });
    expect(within(meta).getByText('Batida')).toBeVisible();
  });
});

describe('Detalhe da meta: mês a mês e memória de cálculo (RF-38)', () => {
  it('CT-01: 80,00% em jan e fev; memória com 16 + 20 = 36 e 20 + 25 = 45; 10 pontos', async () => {
    abrir(`/minhas-metas/${id(10)}`, {
      [`/resultados/meta/${id(10)}`]: { status: 200, corpo: ct01() },
    });
    expect(
      await screen.findByRole('heading', { name: 'Requisições no prazo', level: 1 }),
    ).toBeVisible();
    const resumo = screen.getByRole('region', { name: 'Resumo' });
    expect(valorDe(resumo, 'Acumulado')).toBe('80,00%');
    expect(valorDe(resumo, 'Pontos')).toBe('10,00 de 10');

    const meses = screen.getByRole('table', { name: 'Resultado mês a mês' });
    const janeiro = within(meses).getByRole('row', { name: /Janeiro\/2027/ });
    expect(janeiro).toHaveTextContent('Janeiro/202780,00%80,00%Batida');
    expect(within(meses).getByRole('row', { name: /Março\/2027/ })).toHaveTextContent(
      'Março/2027—80,00%—',
    );

    const valores = screen.getByRole('table', { name: 'Valores usados no cálculo' });
    expect(within(valores).getByRole('row', { name: /Requisições atendidas/ })).toHaveTextContent(
      /^Requisições atendidasREQ_ATENDIDOSSoma36,0016,0020,00/,
    );
    expect(within(valores).getByRole('row', { name: /Total de requisições/ })).toHaveTextContent(
      /^Total de requisiçõesTOTAL_REQSoma45,0020,0025,00/,
    );
    const memoria = screen.getByRole('region', { name: 'Como foi calculado' });
    expect(valorDe(memoria, 'Fórmula')).toBe('REQ_ATENDIDOS / TOTAL_REQ');
    expect(valorDe(memoria, 'Objetivo usado')).toBe('≥ 80,00% (objetivo único)');
    expect(valorDe(memoria, 'Pontos')).toBe('Proporcional: 10 × 100,00% = 10,00 pontos.');
  });

  it('CT-12: mãe com 5 submetas de 20%, atendimento composto 79,91%, 7,99 pontos', async () => {
    abrir(`/minhas-metas/${id(12)}`, {
      [`/resultados/meta/${id(12)}`]: { status: 200, corpo: ct12() },
    });
    const resumo = await screen.findByRole('region', { name: 'Resumo' });
    expect(valorDe(resumo, 'Atendimento composto')).toBe('79,91%');
    expect(valorDe(resumo, 'Pontos')).toBe('7,99 de 10');
    // Sem fórmula própria: sem mês a mês da mãe.
    expect(screen.queryByRole('table', { name: 'Resultado mês a mês' })).toBeNull();

    const composicao = screen.getByRole('table', { name: 'Composição do atendimento' });
    expect(within(composicao).getAllByRole('row')).toHaveLength(6);
    expect(within(composicao).getByRole('row', { name: /Eventos/ })).toHaveTextContent(
      'Eventos20,00%99,54%',
    );
    expect(within(composicao).getByRole('row', { name: /Projeto/ })).toHaveTextContent(
      'Projeto20,00%0,00%',
    );
    const memoria = screen.getByRole('region', { name: 'Como foi calculado' });
    expect(valorDe(memoria, 'Pontos')).toBe('Proporcional: 10 × 79,91% = 7,99 pontos.');
  });

  it('no celular (360 px): mês abreviado e sem a coluna Objetivo, que está no resumo', async () => {
    abrir(
      `/minhas-metas/${id(10)}`,
      { [`/resultados/meta/${id(10)}`]: { status: 200, corpo: ct01() } },
      360,
    );
    const meses = await screen.findByRole('table', { name: 'Resultado mês a mês' });
    expect(
      within(meses)
        .getAllByRole('columnheader')
        .map((c) => c.textContent),
    ).toEqual(['Mês', 'Resultado', 'Situação']);
    expect(within(meses).getByRole('row', { name: /jan\/27/ })).toHaveTextContent(
      'jan/2780,00%Batida',
    );
  });

  it('mês fora do período aparece como histórico (RN-14, CT-06)', async () => {
    const meta = ct01();
    meta.mensal[5] = semMes(6, { resultado: '1', foraPeriodo: true, situacao: null });
    abrir(`/minhas-metas/${id(10)}`, {
      [`/resultados/meta/${id(10)}`]: { status: 200, corpo: meta },
    });
    const meses = await screen.findByRole('table', { name: 'Resultado mês a mês' });
    expect(within(meses).getByRole('row', { name: /Junho\/2027/ })).toHaveTextContent(
      'Histórico (fora do período)',
    );
  });

  it('meta que não é dele: aviso, sem detalhe', async () => {
    abrir(`/minhas-metas/${id(99)}`, {
      [`/resultados/meta/${id(99)}`]: {
        status: 404,
        corpo: erroJson('NAO_ENCONTRADO', 'Meta não encontrada.'),
      },
    });
    expect(await screen.findByText('Meta não encontrada.')).toBeVisible();
  });
});

describe('Início do Gestor (RF-28)', () => {
  const pendencias = (meses: Pendencias['meses']): Pendencias => ({ ciclo: C2027, meses });

  it('nota parcial e o mês com prazo correndo, com o atalho para lançar', async () => {
    abrir('/', {
      '/lancamentos/pendencias': {
        status: 200,
        corpo: pendencias([
          {
            mes: 1,
            status: 'ABERTO',
            fechaEm: '2027-02-22T02:59:59.999Z',
            diasUteisRestantes: 7,
            pendentes: 3,
            total: 5,
          },
        ]),
      },
    });
    const painel = await screen.findByRole('region', { name: 'Pendências' });
    expect(await within(painel).findByText('Faltam 3 de 5 variáveis.')).toBeVisible();
    expect(within(painel).getByText('Fecha em 21/02: faltam 7 dias úteis.')).toBeVisible();
    expect(within(painel).getByRole('link', { name: 'Lançar janeiro' })).toHaveAttribute(
      'href',
      '/lancamentos?mes=1',
    );
    const nota = screen.getByRole('region', { name: 'Nota parcial' });
    expect(await within(nota).findByText('29,99')).toBeVisible();
    expect(within(nota).getByRole('link', { name: 'Ver minhas metas' })).toHaveAttribute(
      'href',
      '/minhas-metas',
    );
  });

  it('mês já todo lançado; sem mês terminado aberto, explica', async () => {
    abrir('/', {
      '/lancamentos/pendencias': {
        status: 200,
        corpo: pendencias([
          {
            mes: 1,
            status: 'ABERTO',
            fechaEm: '2027-02-22T02:59:59.999Z',
            diasUteisRestantes: 1,
            pendentes: 0,
            total: 5,
          },
        ]),
      },
    });
    const painel = await screen.findByRole('region', { name: 'Pendências' });
    expect(await within(painel).findByText('Tudo lançado: 5 variáveis.')).toBeVisible();
    expect(within(painel).getByText('Fecha em 21/02: hoje é o último dia útil.')).toBeVisible();
    expect(within(painel).queryByRole('link')).toBeNull();
  });

  it('nenhum mês aguardando', async () => {
    abrir('/', { '/lancamentos/pendencias': { status: 200, corpo: pendencias([]) } });
    expect(await screen.findByText(/Nenhum mês aguardando lançamento agora/)).toBeVisible();
  });

  it('Administrador não vê o painel do Gestor (vê a Visão geral no P26)', async () => {
    const { chamadas } = renderizarApp({
      respostas: { '/me': { status: 200, corpo: sessaoDe('ADMIN') } },
    });
    await screen.findByText('Todos os setores');
    expect(screen.queryByRole('region', { name: 'Pendências' })).toBeNull();
    await waitFor(() => {
      expect(chamadas.map((c) => c.url).filter((u) => !u.endsWith('/me'))).toEqual([]);
    });
  });
});
