import type { Ciclo, Feriado, ResponsavelSetor, Setor, Usuario } from '@metas/tipos';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { erroJson, renderizarApp, type Resposta, sessaoDe } from './utilitarios';

const ADMIN = sessaoDe('ADMIN');

const usuario = (alteracoes: Partial<Usuario> = {}): Usuario => ({
  id: '11111111-1111-4111-8111-111111111111',
  nome: 'Julia Souza',
  email: 'julia@ectas.com.br',
  perfil: 'GESTOR',
  ativo: true,
  gerenteGeral: false,
  superiorId: null,
  superiorNome: null,
  entrouAlgumaVez: false,
  setoresLeitor: [],
  ...alteracoes,
});

const setor = (alteracoes: Partial<Setor> = {}): Setor => ({
  id: '22222222-2222-4222-8222-222222222222',
  codigo: 'RH',
  nome: 'Recursos Humanos',
  corporativo: false,
  ativo: true,
  ...alteracoes,
});

const lista = (itens: Usuario[]) => ({
  status: 200,
  corpo: { itens, total: itens.length, pagina: 1, tamanho: 20 },
});

function abrir(aba: string, respostas: Record<string, Resposta>, largura = 1440) {
  return renderizarApp({
    caminho: `/cadastros?aba=${aba}`,
    largura,
    respostas: { '/me': { status: 200, corpo: ADMIN }, ...respostas },
  });
}

describe('página de Cadastros', () => {
  it('quem não é Administrador vê só um aviso', async () => {
    renderizarApp({
      caminho: '/cadastros',
      respostas: { '/me': { status: 200, corpo: sessaoDe('GESTOR') } },
    });
    expect(
      await screen.findByText('Os cadastros são mantidos pelo Administrador do sistema.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('abre na aba da URL e troca de aba', async () => {
    const usuarioEvento = userEvent.setup();
    abrir('setores', { '/setores': { status: 200, corpo: [setor()] }, '/usuarios': lista([]) });
    expect(await screen.findByRole('tab', { name: 'Setores', selected: true })).toBeInTheDocument();
    expect(await screen.findByRole('cell', { name: 'Recursos Humanos' })).toBeInTheDocument();
    await usuarioEvento.click(screen.getByRole('tab', { name: 'Usuários' }));
    expect(await screen.findByText(/Nenhum usuário cadastrado ainda/)).toBeInTheDocument();
  });
});

describe('usuários', () => {
  it('lista e cadastra, enviando os dados do formulário', async () => {
    const u = userEvent.setup();
    const { chamadas } = abrir('usuarios', {
      'GET /usuarios': lista([usuario()]),
      'POST /usuarios': (chamada) => ({
        status: 201,
        corpo: usuario({
          ...(chamada.corpo as object),
          id: '33333333-3333-4333-8333-333333333333',
        }),
      }),
    });
    expect(await screen.findByText('julia@ectas.com.br')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Gestor' })).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'Novo usuário' }));
    const dialogo = screen.getByRole('dialog', { name: 'Novo usuário' });
    await u.type(within(dialogo).getByLabelText(/^Nome/), 'Carlos Lima');
    await u.type(
      within(dialogo).getByLabelText(/E-mail da conta Microsoft/),
      'Carlos@Ectas.com.br',
    );
    await u.click(within(dialogo).getByRole('button', { name: 'Cadastrar usuário' }));

    await waitFor(() => {
      expect(chamadas.find((c) => c.metodo === 'POST')?.corpo).toEqual({
        nome: 'Carlos Lima',
        email: 'carlos@ectas.com.br',
        perfil: 'GESTOR',
        ativo: true,
        gerenteGeral: false,
        superiorId: null,
      });
    });
    expect(await screen.findByText('Usuário cadastrado.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('valida no navegador antes de enviar', async () => {
    const u = userEvent.setup();
    const { chamadas } = abrir('usuarios', { 'GET /usuarios': lista([]) });
    await u.click(await screen.findByRole('button', { name: 'Novo usuário' }));
    const dialogo = screen.getByRole('dialog');
    await u.type(within(dialogo).getByLabelText(/E-mail da conta Microsoft/), 'sem-arroba');
    await u.click(within(dialogo).getByRole('button', { name: 'Cadastrar usuário' }));
    expect(await within(dialogo).findByText('E-mail inválido.')).toBeInTheDocument();
    expect(
      within(dialogo).getByText('O nome precisa ter ao menos 2 caracteres.'),
    ).toBeInTheDocument();
    expect(chamadas.some((c) => c.metodo === 'POST')).toBe(false);
  });

  it('mostra o erro da API no diálogo (e-mail repetido)', async () => {
    const u = userEvent.setup();
    abrir('usuarios', {
      'GET /usuarios': lista([]),
      'POST /usuarios': {
        status: 409,
        corpo: erroJson('JA_EXISTE', 'Já existe um usuário com este e-mail.'),
      },
    });
    await u.click(await screen.findByRole('button', { name: 'Novo usuário' }));
    const dialogo = screen.getByRole('dialog');
    await u.type(within(dialogo).getByLabelText(/^Nome/), 'Repetido');
    await u.type(within(dialogo).getByLabelText(/E-mail da conta Microsoft/), 'julia@ectas.com.br');
    await u.click(within(dialogo).getByRole('button', { name: 'Cadastrar usuário' }));
    expect(
      await within(dialogo).findByText('Já existe um usuário com este e-mail.'),
    ).toBeInTheDocument();
  });

  it('erro de validação da API vai para o campo', async () => {
    const u = userEvent.setup();
    abrir('usuarios', {
      'GET /usuarios': lista([usuario()]),
      'PUT /usuarios/11111111-1111-4111-8111-111111111111': {
        status: 400,
        corpo: {
          codigo: 'VALIDACAO',
          mensagem: 'Dados inválidos.',
          detalhes: {
            campos: [{ campo: 'superiorId', mensagem: 'Superior imediato não encontrado.' }],
          },
        },
      },
    });
    await u.click(await screen.findByRole('button', { name: 'Editar Julia Souza' }));
    const dialogo = screen.getByRole('dialog', { name: 'Editar usuário' });
    await u.click(within(dialogo).getByRole('button', { name: 'Salvar usuário' }));
    expect(
      await within(dialogo).findByText('Superior imediato não encontrado.'),
    ).toBeInTheDocument();
  });

  it('exclusão pede confirmação e mostra quando o usuário está em uso', async () => {
    const u = userEvent.setup();
    const { chamadas } = abrir('usuarios', {
      'GET /usuarios': lista([usuario()]),
      'DELETE /usuarios/11111111-1111-4111-8111-111111111111': {
        status: 409,
        corpo: erroJson('EM_USO', 'Este usuário tem registros associados. Inative-o.'),
      },
    });
    await u.click(await screen.findByRole('button', { name: 'Excluir Julia Souza' }));
    expect(chamadas.some((c) => c.metodo === 'DELETE')).toBe(false);
    const dialogo = screen.getByRole('dialog', { name: 'Excluir usuário?' });
    await u.click(within(dialogo).getByRole('button', { name: 'Excluir usuário' }));
    expect(
      await within(dialogo).findByText('Este usuário tem registros associados. Inative-o.'),
    ).toBeInTheDocument();
  });

  it('o Administrador logado não tem botão de excluir a si mesmo', async () => {
    abrir('usuarios', {
      'GET /usuarios': lista([
        usuario({ id: ADMIN.usuario.id, nome: 'Eu Mesmo', perfil: 'ADMIN' }),
      ]),
    });
    expect(await screen.findByRole('button', { name: 'Editar Eu Mesmo' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Excluir Eu Mesmo' })).not.toBeInTheDocument();
  });

  it('no celular a lista vira cartões', async () => {
    abrir('usuarios', { 'GET /usuarios': lista([usuario()]) }, 360);
    const cartoes = await screen.findByRole('list', { name: 'Usuários' });
    expect(within(cartoes).getByText('Julia Souza')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('setores', () => {
  it('Corporativo não tem botão de excluir', async () => {
    abrir('setores', {
      '/setores': {
        status: 200,
        corpo: [
          setor({
            id: '44444444-4444-4444-8444-444444444444',
            nome: 'Corporativo',
            codigo: 'CORP',
            corporativo: true,
          }),
          setor(),
        ],
      },
    });
    expect(
      await screen.findByRole('button', { name: 'Excluir Recursos Humanos' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Excluir Corporativo' })).not.toBeInTheDocument();
    // Nome do setor e bloco das metas: as duas células dizem "Corporativo".
    expect(screen.getAllByRole('cell', { name: 'Corporativo' })).toHaveLength(2);
    expect(screen.getByRole('cell', { name: 'Departamental' })).toBeInTheDocument();
  });
});

describe('feriados', () => {
  const feriado: Feriado = {
    id: '55555555-5555-4555-8555-555555555555',
    data: '2026-11-20',
    descricao: 'Consciência Negra',
    tipo: 'NACIONAL',
  };

  it('lista com data e dia da semana; mês fechado aparece no diálogo', async () => {
    const u = userEvent.setup();
    abrir('feriados', {
      'GET /feriados': { status: 200, corpo: [feriado] },
      'PUT /feriados/55555555-5555-4555-8555-555555555555': {
        status: 422,
        corpo: erroJson(
          'MES_FECHADO',
          'Esta alteração mudaria o prazo de fechamento de Outubro/2026, que fechou em 24/11/2026.',
        ),
      },
    });
    expect(await screen.findByText('20/11/2026')).toBeInTheDocument();
    expect(screen.getByText('sexta-feira')).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'Editar Consciência Negra' }));
    const dialogo = screen.getByRole('dialog', { name: 'Editar feriado' });
    await u.click(within(dialogo).getByRole('button', { name: 'Salvar feriado' }));
    expect(await within(dialogo).findByText(/que fechou em 24\/11\/2026/)).toBeInTheDocument();
  });

  it('navega entre os anos', async () => {
    const u = userEvent.setup();
    const { chamadas } = abrir('feriados', { 'GET /feriados': { status: 200, corpo: [] } });
    const ano = new Date().getFullYear();
    await u.click(await screen.findByRole('button', { name: `Próximo ano (${String(ano + 1)})` }));
    await waitFor(() => {
      expect(chamadas.some((c) => c.url.endsWith(`/feriados?ano=${String(ano + 1)}`))).toBe(true);
    });
  });
});

describe('ciclos e responsáveis', () => {
  const ciclo: Ciclo = {
    id: '66666666-6666-4666-8666-666666666666',
    ano: 2027,
    status: 'RASCUNHO',
    encerradoEm: null,
  };
  const responsaveis: ResponsavelSetor[] = [
    { setor: setor(), usuarioId: null, usuarioNome: null },
    {
      setor: setor({
        id: '77777777-7777-4777-8777-777777777777',
        nome: 'Tecnologia',
        codigo: 'TI',
      }),
      usuarioId: '11111111-1111-4111-8111-111111111111',
      usuarioNome: 'Julia Souza',
    },
  ];

  it('envia só os setores alterados', async () => {
    const u = userEvent.setup();
    const { chamadas } = abrir('ciclos', {
      '/ciclos': { status: 200, corpo: [ciclo] },
      'GET /ciclos/66666666-6666-4666-8666-666666666666/responsaveis': {
        status: 200,
        corpo: responsaveis,
      },
      'PUT /ciclos/66666666-6666-4666-8666-666666666666/responsaveis': {
        status: 200,
        corpo: responsaveis,
      },
      '/usuarios': lista([
        usuario(),
        usuario({ id: '88888888-8888-4888-8888-888888888888', nome: 'Bruno' }),
      ]),
    });
    expect(
      await screen.findByText(
        '1 setor ativo sem responsável. Só Gestores ativos aparecem na lista.',
      ),
    ).toBeInTheDocument();
    const salvar = screen.getByRole('button', { name: 'Salvar responsáveis' });
    expect(salvar).toBeDisabled();

    await u.click(screen.getByRole('combobox', { name: 'Recursos Humanos' }));
    await u.click(await screen.findByRole('option', { name: 'Bruno' }));
    expect(screen.getByText('1 alteração não salva')).toBeInTheDocument();
    await u.click(salvar);

    await waitFor(() => {
      expect(chamadas.find((c) => c.metodo === 'PUT')?.corpo).toEqual({
        responsaveis: [{ setorId: setor().id, usuarioId: '88888888-8888-4888-8888-888888888888' }],
      });
    });
    expect(await screen.findByText('Responsáveis salvos.')).toBeInTheDocument();
  });

  it('ciclo encerrado fica só para leitura', async () => {
    abrir('ciclos', {
      '/ciclos': {
        status: 200,
        corpo: [{ ...ciclo, status: 'ENCERRADO', encerradoEm: '2027-12-31T03:00:00.000Z' }],
      },
      '/ciclos/66666666-6666-4666-8666-666666666666/responsaveis': {
        status: 200,
        corpo: responsaveis,
      },
      '/usuarios': lista([usuario()]),
    });
    expect(
      await screen.findByText('Ciclo encerrado: os responsáveis não podem mais mudar.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Salvar responsáveis' })).not.toBeInTheDocument();
  });

  it('cria ciclo sugerindo o próximo ano', async () => {
    const u = userEvent.setup();
    const { chamadas } = abrir('ciclos', {
      'GET /ciclos': { status: 200, corpo: [ciclo] },
      'POST /ciclos': {
        status: 201,
        corpo: { ...ciclo, id: '99999999-9999-4999-8999-999999999999', ano: 2028 },
      },
      '/ciclos/66666666-6666-4666-8666-666666666666/responsaveis': { status: 200, corpo: [] },
      '/ciclos/99999999-9999-4999-8999-999999999999/responsaveis': { status: 200, corpo: [] },
      '/usuarios': lista([]),
    });
    await u.click(await screen.findByRole('button', { name: 'Novo ciclo' }));
    const dialogo = screen.getByRole('dialog', { name: 'Novo ciclo' });
    expect(within(dialogo).getByLabelText(/Ano/)).toHaveValue(2028);
    await u.click(within(dialogo).getByRole('button', { name: 'Criar ciclo' }));
    await waitFor(() => {
      expect(chamadas.find((c) => c.metodo === 'POST')?.corpo).toEqual({ ano: 2028 });
    });
    expect(await screen.findByText('Ciclo 2028 criado como rascunho.')).toBeInTheDocument();
  });
});
