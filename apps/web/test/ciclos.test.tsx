import type { Ciclo, ConsistenciaCiclo, ProblemaConsistencia } from '@metas/tipos';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { erroJson, renderizarApp, type Resposta, sessaoDe } from './utilitarios';

const CICLO: Ciclo = {
  id: '44444444-4444-4444-8444-444444444444',
  ano: 2027,
  status: 'RASCUNHO',
  encerradoEm: null,
};
const JULIA = '11111111-1111-4111-8111-111111111111';
const META = '66666666-6666-4666-8666-666666666666';
const ROTA = `/ciclos/${CICLO.id}`;

const problema = (alteracoes: Partial<ProblemaConsistencia>): ProblemaConsistencia => ({
  tipo: 'PESOS_GESTOR',
  gravidade: 'BLOQUEIA',
  codigo: 'PESOS_INCONSISTENTES',
  mensagem: 'Julia Souza: Os pesos do bloco Departamental somam 90,00; deveriam somar 100,00.',
  metaId: null,
  metaCodigo: null,
  variavelId: null,
  setorId: null,
  usuarioId: JULIA,
  ...alteracoes,
});

/** Painel do CT-17: Julia com departamentais somando 90. */
const painel = (alteracoes: Partial<ConsistenciaCiclo> = {}): ConsistenciaCiclo => ({
  ciclo: CICLO,
  podeAtivar: false,
  motivoNaoAtivar: null,
  gestores: [
    {
      usuarioId: JULIA,
      nome: 'Julia Souza',
      ativo: true,
      corporativo: '0',
      departamental: '90',
      total: '90',
      comCorporativas: false,
      ok: false,
    },
  ],
  problemas: [
    problema({}),
    problema({
      tipo: 'RESPONSAVEL_DIFERENTE',
      gravidade: 'AVISO',
      codigo: 'VALIDACAO',
      mensagem: 'FISCAL_PRAZO: o responsável é Carlos Lima, mas o setor tem Julia Souza.',
      metaId: META,
      metaCodigo: 'FISCAL_PRAZO',
    }),
  ],
  encerramento: {
    permitido: false,
    motivo: 'Só um ciclo ativo pode ser encerrado.',
    dezembroFechaEm: '2028-01-22T02:59:59.999Z',
  },
  ...alteracoes,
});

function abrir(respostas: Record<string, Resposta>, largura = 1440) {
  return renderizarApp({
    caminho: '/ciclos',
    largura,
    respostas: {
      '/me': { status: 200, corpo: sessaoDe('ADMIN') },
      '/ciclos': { status: 200, corpo: [CICLO] },
      ...respostas,
    },
  });
}

describe('Ciclos e consistência (P15)', () => {
  it('CT-17: mostra os pesos que não fecham, o bloqueio e não deixa ativar', async () => {
    abrir({ [`${ROTA}/consistencia`]: { status: 200, corpo: painel() } });

    expect(await screen.findByRole('heading', { name: 'Ciclo 2027: rascunho' })).toBeVisible();
    expect(
      screen.getByText('1 item impede a ativação. Resolva e volte a esta tela.'),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Ativar ciclo 2027' })).toBeDisabled();

    const pesos = screen.getByRole('table', { name: 'Pesos por gestor' });
    const linha = within(pesos).getByRole('row', { name: /Julia Souza/ });
    // Departamental e total: 90 de 100.
    expect(within(linha).getAllByText('90,00 de 100', { selector: 'td' })).toHaveLength(2);
    expect(within(linha).getByText('Não fecha')).toBeVisible();

    expect(screen.getByRole('heading', { name: 'Impedem a ativação (1)' })).toBeVisible();
    expect(screen.getByText(/somam 90,00; deveriam somar 100,00/)).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Avisos (1)' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Abrir FISCAL_PRAZO' })).toHaveAttribute(
      'href',
      `/metas/${META}`,
    );
  });

  it('sem bloqueios: confirma e ativa', async () => {
    const usuario = userEvent.setup();
    const ativo = painel({
      ciclo: { ...CICLO, status: 'ATIVO' },
      podeAtivar: false,
      motivoNaoAtivar: 'O ciclo 2027 já está ativo.',
      problemas: [],
      encerramento: {
        permitido: false,
        motivo:
          'Dezembro/2027 aceita lançamentos até 21/01/2028. O ciclo só pode ser encerrado depois.',
        dezembroFechaEm: '2028-01-22T02:59:59.999Z',
      },
    });
    let ativou = false;
    const { chamadas } = abrir({
      [`${ROTA}/consistencia`]: () => ({
        status: 200,
        corpo: ativou ? ativo : painel({ podeAtivar: true, problemas: [] }),
      }),
      [`POST ${ROTA}/ativar`]: () => {
        ativou = true;
        return { status: 200, corpo: { ...CICLO, status: 'ATIVO' } };
      },
    });

    expect(await screen.findByText('Nenhum problema encontrado neste ciclo.')).toBeVisible();
    await usuario.click(screen.getByRole('button', { name: 'Ativar ciclo 2027' }));
    const dialogo = screen.getByRole('dialog', { name: 'Ativar o ciclo 2027?' });
    await usuario.click(within(dialogo).getByRole('button', { name: 'Ativar ciclo' }));

    expect(await screen.findByText('Ciclo 2027 ativado.')).toBeVisible();
    expect(chamadas.some((c) => c.metodo === 'POST' && c.url.endsWith('/ativar'))).toBe(true);
    expect(await screen.findByRole('heading', { name: 'Ciclo 2027: ativo' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Encerrar ciclo 2027' })).toBeDisabled();
    expect(screen.getByText(/aceita lançamentos até 21\/01\/2028/)).toBeVisible();
  });

  it('erro da API na ativação aparece no diálogo', async () => {
    const usuario = userEvent.setup();
    abrir({
      [`${ROTA}/consistencia`]: { status: 200, corpo: painel({ podeAtivar: true, problemas: [] }) },
      [`POST ${ROTA}/ativar`]: {
        status: 422,
        corpo: erroJson('STATUS_CICLO_INVALIDO', 'Encerre o ciclo 2026 antes de ativar o 2027.'),
      },
    });
    await usuario.click(await screen.findByRole('button', { name: 'Ativar ciclo 2027' }));
    const dialogo = screen.getByRole('dialog');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Ativar ciclo' }));
    expect(
      await within(dialogo).findByText('Encerre o ciclo 2026 antes de ativar o 2027.'),
    ).toBeVisible();
  });

  it('encerrar pede confirmação com aviso de que não se desfaz', async () => {
    const usuario = userEvent.setup();
    const { chamadas } = abrir({
      [`${ROTA}/consistencia`]: {
        status: 200,
        corpo: painel({
          ciclo: { ...CICLO, status: 'ATIVO' },
          motivoNaoAtivar: 'O ciclo 2027 já está ativo.',
          problemas: [],
          encerramento: {
            permitido: true,
            motivo: null,
            dezembroFechaEm: '2028-01-22T02:59:59.999Z',
          },
        }),
      },
      [`POST ${ROTA}/encerrar`]: {
        status: 200,
        corpo: { ...CICLO, status: 'ENCERRADO', encerradoEm: '2028-01-25T13:00:00.000Z' },
      },
    });
    expect(await screen.findByText(/Dezembro fechou em 21\/01\/2028/)).toBeVisible();
    await usuario.click(screen.getByRole('button', { name: 'Encerrar ciclo 2027' }));
    const dialogo = screen.getByRole('dialog', { name: 'Encerrar o ciclo 2027?' });
    expect(within(dialogo).getByText(/Não é possível desfazer/)).toBeVisible();
    await usuario.click(within(dialogo).getByRole('button', { name: 'Encerrar ciclo' }));
    expect(await screen.findByText('Ciclo 2027 encerrado.')).toBeVisible();
    expect(chamadas.filter((c) => c.metodo === 'POST').map((c) => c.url)).toEqual([
      expect.stringMatching(/\/encerrar$/) as string,
    ]);
  });

  it('no celular (360 px) os pesos viram cartões', async () => {
    abrir({ [`${ROTA}/consistencia`]: { status: 200, corpo: painel() } }, 360);
    expect(await screen.findByRole('heading', { name: 'Ciclo 2027: rascunho' })).toBeVisible();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getAllByText('Não fecha').length).toBeGreaterThan(0);
  });

  it('quem não é Administrador vê só o aviso', async () => {
    renderizarApp({
      caminho: '/ciclos',
      respostas: { '/me': { status: 200, corpo: sessaoDe('DIRETORIA') } },
    });
    expect(
      await screen.findByText('Os ciclos são ativados e encerrados pelo Administrador.'),
    ).toBeVisible();
  });
});
