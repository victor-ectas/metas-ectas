import type { Ciclo, Setor, Variavel } from '@metas/tipos';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { erroJson, renderizarApp, type Resposta, sessaoDe } from './utilitarios';

const CICLO: Ciclo = {
  id: '44444444-4444-4444-8444-444444444444',
  ano: 2027,
  status: 'RASCUNHO',
  encerradoEm: null,
};
const RH: Setor = {
  id: '22222222-2222-4222-8222-222222222222',
  codigo: 'RH',
  nome: 'Recursos Humanos',
  corporativo: false,
  ativo: true,
};
const CORP: Setor = {
  id: '55555555-5555-4555-8555-555555555555',
  codigo: 'CORP',
  nome: 'Corporativo',
  corporativo: true,
  ativo: true,
};
const GESTOR_ID = '11111111-1111-4111-8111-111111111111';
const ROTA = `/ciclos/${CICLO.id}/variaveis`;

const variavel = (alteracoes: Partial<Variavel> = {}): Variavel => ({
  id: '66666666-6666-4666-8666-666666666666',
  cicloId: CICLO.id,
  setorId: RH.id,
  setorCodigo: 'RH',
  setorNome: 'Recursos Humanos',
  codigo: 'PRESENCAS',
  nome: 'Presenças no treinamento',
  tipo: 'NUMERO',
  acumulacao: 'SOMA',
  origem: 'DIGITADA',
  responsavelId: null,
  responsavelNome: null,
  casasDecimais: 0,
  ativo: true,
  temLancamentos: false,
  usadaPor: [],
  ...alteracoes,
});

function abrir(
  respostas: Record<string, Resposta>,
  opcoes: { ciclo?: Ciclo; largura?: number } = {},
) {
  return renderizarApp({
    caminho: '/variaveis',
    largura: opcoes.largura ?? 1440,
    respostas: {
      '/me': { status: 200, corpo: sessaoDe('ADMIN') },
      '/ciclos': { status: 200, corpo: [opcoes.ciclo ?? CICLO] },
      '/setores': { status: 200, corpo: [CORP, RH] },
      '/usuarios': {
        status: 200,
        corpo: {
          itens: [
            {
              id: GESTOR_ID,
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

describe('página de Variáveis', () => {
  it('quem não é Administrador vê só um aviso', async () => {
    renderizarApp({
      caminho: '/variaveis',
      respostas: { '/me': { status: 200, corpo: sessaoDe('GESTOR') } },
    });
    expect(
      await screen.findByText('As variáveis são cadastradas pelo Administrador do sistema.'),
    ).toBeInTheDocument();
  });

  it('lista com o código completo, as metas que usam e filtra por busca e setor', async () => {
    const u = userEvent.setup();
    abrir({
      [`GET ${ROTA}`]: {
        status: 200,
        corpo: [
          variavel({
            usadaPor: [
              { id: CICLO.id, codigo: 'RH_TREINO', indicador: 'Treinamento', ativo: true },
            ],
          }),
          variavel({
            id: '77777777-7777-4777-8777-777777777777',
            setorId: CORP.id,
            setorCodigo: 'CORP',
            setorNome: 'Corporativo',
            codigo: 'ENTRADAS',
            nome: 'Entradas de caixa',
            tipo: 'MOEDA',
          }),
        ],
      },
    });
    expect(await screen.findByText('RH.PRESENCAS')).toBeInTheDocument();
    expect(screen.getByText('RH_TREINO')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma meta')).toBeInTheDocument();
    expect(screen.getByText('2 variáveis')).toBeInTheDocument();

    await u.type(screen.getByRole('searchbox', { name: 'Buscar' }), 'caixa');
    await waitFor(() => {
      expect(screen.queryByText('RH.PRESENCAS')).not.toBeInTheDocument();
    });
    expect(screen.getByText('CORP.ENTRADAS')).toBeInTheDocument();

    await u.clear(screen.getByRole('searchbox', { name: 'Buscar' }));
    await u.click(screen.getByRole('combobox', { name: 'Setor' }));
    await u.click(screen.getByRole('option', { name: 'Recursos Humanos' }));
    expect(await screen.findByText('RH.PRESENCAS')).toBeInTheDocument();
    expect(screen.queryByText('CORP.ENTRADAS')).not.toBeInTheDocument();
  });

  it('só mostra Excluir em variável sem lançamentos e sem metas', async () => {
    abrir({
      [`GET ${ROTA}`]: {
        status: 200,
        corpo: [
          variavel(),
          variavel({
            id: '77777777-7777-4777-8777-777777777777',
            codigo: 'USADA',
            temLancamentos: true,
          }),
        ],
      },
    });
    expect(await screen.findByRole('button', { name: 'Excluir PRESENCAS' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Excluir USADA' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar USADA' })).toBeInTheDocument();
  });

  it('ciclo encerrado: só consulta', async () => {
    abrir(
      { [`GET ${ROTA}`]: { status: 200, corpo: [variavel()] } },
      { ciclo: { ...CICLO, status: 'ENCERRADO', encerradoEm: '2028-01-31T12:00:00.000Z' } },
    );
    expect(
      await screen.findByText(/está encerrado: as variáveis ficam só para consulta/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nova variável' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar PRESENCAS' })).not.toBeInTheDocument();
  });

  it('no celular vira cartões, sem perder o código', async () => {
    abrir({ [`GET ${ROTA}`]: { status: 200, corpo: [variavel()] } }, { largura: 360 });
    const lista = await screen.findByRole('list', { name: 'Variáveis' });
    expect(within(lista).getByText('RH.PRESENCAS')).toBeInTheDocument();
    expect(within(lista).queryByText('Recursos Humanos')).not.toBeInTheDocument();
  });
});

describe('cadastro e edição', () => {
  it('cadastra no Corporativo com responsável e envia o código em maiúsculas', async () => {
    const u = userEvent.setup();
    const { chamadas } = abrir({
      [`GET ${ROTA}`]: { status: 200, corpo: [] },
      [`POST ${ROTA}`]: (chamada) => ({
        status: 201,
        corpo: variavel({ ...(chamada.corpo as object) }),
      }),
    });
    await u.click(await screen.findByRole('button', { name: 'Nova variável' }));
    const dialogo = screen.getByRole('dialog', { name: 'Nova variável' });
    await u.type(within(dialogo).getByLabelText(/^Nome/), 'Entradas de caixa');
    await u.type(within(dialogo).getByLabelText(/^Código/), 'entradas');
    await u.click(within(dialogo).getByRole('combobox', { name: /Setor que lança/ }));
    await u.click(screen.getByRole('option', { name: 'Corporativo' }));
    await u.click(within(dialogo).getByRole('combobox', { name: /Responsável pelo lançamento/ }));
    await u.click(screen.getByRole('option', { name: 'Julia Souza' }));
    await u.click(within(dialogo).getByRole('combobox', { name: /^Tipo/ }));
    await u.click(screen.getByRole('option', { name: 'Moeda (R$)' }));
    await u.click(within(dialogo).getByRole('button', { name: 'Cadastrar variável' }));

    await waitFor(() => {
      expect(chamadas.find((c) => c.metodo === 'POST')?.corpo).toEqual({
        setorId: CORP.id,
        codigo: 'ENTRADAS',
        nome: 'Entradas de caixa',
        tipo: 'MOEDA',
        acumulacao: 'SOMA',
        origem: 'DIGITADA',
        responsavelId: GESTOR_ID,
        casasDecimais: 2,
        ativo: true,
      });
    });
    expect(await screen.findByText('Variável cadastrada.')).toBeInTheDocument();
  });

  it('fora do Corporativo não pede responsável', async () => {
    const u = userEvent.setup();
    abrir({ [`GET ${ROTA}`]: { status: 200, corpo: [] } });
    await u.click(await screen.findByRole('button', { name: 'Nova variável' }));
    const dialogo = screen.getByRole('dialog');
    await u.click(within(dialogo).getByRole('combobox', { name: /Setor que lança/ }));
    await u.click(screen.getByRole('option', { name: 'Recursos Humanos' }));
    expect(
      within(dialogo).queryByRole('combobox', { name: /Responsável/ }),
    ).not.toBeInTheDocument();
  });

  it('variável em uso: setor, tipo e acumulação travados e aviso de renomeação', async () => {
    const u = userEvent.setup();
    const { chamadas } = abrir({
      [`GET ${ROTA}`]: {
        status: 200,
        corpo: [
          variavel({
            usadaPor: [
              { id: CICLO.id, codigo: 'RH_TREINO', indicador: 'Treinamento', ativo: true },
            ],
          }),
        ],
      },
      [`PUT ${ROTA}/66666666-6666-4666-8666-666666666666`]: (chamada) => ({
        status: 200,
        corpo: variavel({ ...(chamada.corpo as object) }),
      }),
    });
    await u.click(await screen.findByRole('button', { name: 'Editar PRESENCAS' }));
    const dialogo = screen.getByRole('dialog', { name: 'Editar PRESENCAS' });
    for (const nome of [/Setor que lança/, /^Tipo/, /Acumulação/]) {
      expect(within(dialogo).getByRole('combobox', { name: nome })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    }
    expect(within(dialogo).getAllByText('Fixo: a variável já é usada por metas.')).toHaveLength(3);

    const codigo = within(dialogo).getByLabelText(/^Código/);
    await u.clear(codigo);
    await u.type(codigo, 'presentes');
    expect(
      within(dialogo).getByText(/o código muda também nas fórmulas de 1 meta/),
    ).toBeInTheDocument();
    await u.click(within(dialogo).getByRole('button', { name: 'Salvar variável' }));
    await waitFor(() => {
      expect(chamadas.find((c) => c.metodo === 'PUT')?.corpo).toMatchObject({
        codigo: 'PRESENTES',
      });
    });
  });

  it('erro de validação da API vai para o campo', async () => {
    const u = userEvent.setup();
    abrir({
      [`GET ${ROTA}`]: { status: 200, corpo: [variavel()] },
      [`PUT ${ROTA}/66666666-6666-4666-8666-666666666666`]: {
        status: 400,
        corpo: {
          ...erroJson('VALIDACAO', 'O tipo não pode mudar: a variável já tem lançamentos.'),
          detalhes: {
            campos: [
              { campo: 'tipo', mensagem: 'O tipo não pode mudar: a variável já tem lançamentos.' },
            ],
          },
        },
      },
    });
    await u.click(await screen.findByRole('button', { name: 'Editar PRESENCAS' }));
    const dialogo = screen.getByRole('dialog');
    await u.click(within(dialogo).getByRole('button', { name: 'Salvar variável' }));
    expect(
      await within(dialogo).findAllByText('O tipo não pode mudar: a variável já tem lançamentos.'),
    ).not.toHaveLength(0);
  });

  it('exclui depois de confirmar', async () => {
    const u = userEvent.setup();
    const { chamadas } = abrir({
      [`GET ${ROTA}`]: { status: 200, corpo: [variavel()] },
      [`DELETE ${ROTA}/66666666-6666-4666-8666-666666666666`]: { status: 204, corpo: null },
    });
    await u.click(await screen.findByRole('button', { name: 'Excluir PRESENCAS' }));
    await u.click(screen.getByRole('button', { name: 'Excluir variável' }));
    expect(await screen.findByText('Variável excluída.')).toBeInTheDocument();
    expect(chamadas.some((c) => c.metodo === 'DELETE')).toBe(true);
  });
});
