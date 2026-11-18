import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { AutenticacaoEntra } from '../src/auth/autenticacao';
import { CABECALHO_USUARIO_DEV, criarAutenticacaoDev } from '../src/auth/dev';
import { erroJson, renderizarApp, sessaoDe } from './utilitarios';

const SETORES = [
  {
    id: 'a1b2c3d4-0000-4000-8000-000000000001',
    codigo: 'RH',
    nome: 'Recursos Humanos',
    corporativo: false,
  },
  {
    id: 'a1b2c3d4-0000-4000-8000-000000000002',
    codigo: 'TI',
    nome: 'Tecnologia',
    corporativo: false,
  },
];

describe('layout em 1440 px (desktop)', () => {
  it('mostra o menu lateral fixo, sem botão de abrir menu', async () => {
    renderizarApp({ respostas: { '/me': { status: 200, corpo: sessaoDe('ADMIN') } } });
    expect(await screen.findByRole('heading', { name: 'Olá, Julia' })).toBeInTheDocument();

    const menu = screen.getByRole('navigation', { name: 'Menu principal' });
    expect(within(menu).getByRole('link', { name: 'Cadastros' })).toBeVisible();
    expect(within(menu).getByRole('link', { name: 'Início' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.queryByRole('button', { name: 'Abrir menu' })).not.toBeInTheDocument();
    expect(screen.getByText('Julia Martins Souza')).toBeInTheDocument();
  });

  it('navega pelo menu para uma tela em construção', async () => {
    const usuario = userEvent.setup();
    renderizarApp({ respostas: { '/me': { status: 200, corpo: sessaoDe('ADMIN') } } });
    const menu = await screen.findByRole('navigation', { name: 'Menu principal' });
    await usuario.click(within(menu).getByRole('link', { name: 'Catálogo de modelos' }));
    expect(await screen.findByRole('heading', { name: 'Catálogo de modelos' })).toBeInTheDocument();
    expect(screen.getByText(/passo P25 do plano/)).toBeInTheDocument();
    expect(within(menu).getByRole('link', { name: 'Catálogo de modelos' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});

describe('layout em 360 px (celular)', () => {
  it('esconde o menu numa gaveta, que abre pelo botão e fecha ao navegar', async () => {
    const usuario = userEvent.setup();
    renderizarApp({
      largura: 360,
      respostas: { '/me': { status: 200, corpo: sessaoDe('GESTOR', { setores: SETORES }) } },
    });
    expect(await screen.findByRole('heading', { name: 'Olá, Julia' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Menu principal' })).not.toBeInTheDocument();

    const abrir = screen.getByRole('button', { name: 'Abrir menu' });
    expect(abrir).toHaveAttribute('aria-expanded', 'false');
    await usuario.click(abrir);
    const menu = await screen.findByRole('navigation', { name: 'Menu principal' });
    expect(
      within(menu)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Início', 'Minhas metas', 'Lançamentos', 'Importar', 'Configurações']);

    await usuario.click(within(menu).getByRole('link', { name: 'Lançamentos' }));
    expect(await screen.findByRole('heading', { name: 'Lançamentos' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('navigation', { name: 'Menu principal' })).not.toBeInTheDocument();
    });
  });
});

describe('Início', () => {
  it('Gestor vê o que faz no sistema e os atalhos (a conta fica nas Configurações)', async () => {
    const gestor = sessaoDe('GESTOR', { setores: SETORES });
    renderizarApp({
      respostas: {
        '/me': { status: 200, corpo: gestor },
        '/lancamentos/pendencias': { status: 200, corpo: { ciclo: null, meses: [] } },
        [`/resultados/gestor/${gestor.usuario.id}`]: {
          status: 200,
          corpo: { ciclo: null, ciclos: [], usuario: gestor.usuario, notas: null, metas: [] },
        },
      },
    });
    await screen.findByRole('heading', { name: 'Olá, Julia' });
    expect(
      screen.getByText('Lance os resultados de cada mês e acompanhe suas metas.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Seu acesso' })).not.toBeInTheDocument();
    const atalhos = screen.getByRole('region', { name: 'Atalhos' });
    expect(within(atalhos).getByRole('link', { name: 'Lançamentos' })).toHaveAttribute(
      'href',
      '/lancamentos',
    );
    expect(within(atalhos).queryByRole('link', { name: 'Configurações' })).not.toBeInTheDocument();
  });

  it('Administrador vê nome e perfil na barra superior', async () => {
    renderizarApp({ respostas: { '/me': { status: 200, corpo: sessaoDe('ADMIN') } } });
    await screen.findByRole('heading', { name: 'Olá, Julia' });
    // Barra superior do desktop: nome e perfil de quem está logado.
    expect(screen.getByRole('banner')).toHaveTextContent('Julia Martins SouzaAdministrador');
  });

  it('usuário inativo vê o aviso e nenhum atalho', async () => {
    const corpo = sessaoDe('LEITOR', { ativo: false });
    corpo.usuario.gerenteGeral = true;
    renderizarApp({ respostas: { '/me': { status: 200, corpo } } });
    expect(await screen.findByText('Seu acesso ainda não foi liberado')).toBeInTheDocument();
    // Inativo não vê a descrição do que o perfil faz.
    expect(screen.queryByText(/Consulte os resultados/)).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Atalhos' })).not.toBeInTheDocument();
    // Inativo vê só o Início e as Configurações (aparência e a própria conta).
    const menu = screen.getByRole('navigation', { name: 'Menu principal' });
    expect(
      within(menu)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Início', 'Configurações']);
  });
});

describe('erros e rotas', () => {
  it('erro do /me aparece com a mensagem da API e permite tentar de novo', async () => {
    const usuario = userEvent.setup();
    const { chamadas } = renderizarApp({
      respostas: {
        '/me': { status: 401, corpo: erroJson('NAO_AUTENTICADO', 'Usuário simulado não existe.') },
      },
    });
    expect(await screen.findByText('Não foi possível carregar seus dados')).toBeInTheDocument();
    expect(screen.getByText('Usuário simulado não existe.')).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    await waitFor(() => {
      expect(chamadas).toHaveLength(2);
    });
  });

  it('endereço desconhecido', async () => {
    renderizarApp({
      caminho: '/nao-existe',
      respostas: { '/me': { status: 200, corpo: sessaoDe('GESTOR') } },
    });
    expect(
      await screen.findByRole('heading', { name: 'Página não encontrada' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir para o Início' })).toHaveAttribute('href', '/');
  });
});

describe('autenticação no layout', () => {
  it('modo DEV: troca o usuário simulado e refaz a consulta com o X-Usuario-Dev', async () => {
    const usuario = userEvent.setup();
    const { chamadas } = renderizarApp({
      autenticacao: criarAutenticacaoDev(localStorage),
      respostas: { '/me': { status: 200, corpo: sessaoDe('ADMIN') } },
    });
    await usuario.click(await screen.findByRole('button', { name: 'DEV: usuário padrão' }));
    const dialogo = screen.getByRole('dialog', { name: 'Usuário simulado (modo DEV)' });
    await usuario.type(
      within(dialogo).getByLabelText('E-mail do usuário'),
      'gestor@empresa.com.br',
    );
    await usuario.click(within(dialogo).getByRole('button', { name: 'Usar este' }));

    await waitFor(() => {
      expect(chamadas.at(-1)?.cabecalhos[CABECALHO_USUARIO_DEV]).toBe('gestor@empresa.com.br');
    });
    expect(chamadas[0]?.cabecalhos[CABECALHO_USUARIO_DEV]).toBeUndefined();
    expect(
      await screen.findByRole('button', { name: 'DEV: gestor@empresa.com.br' }),
    ).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'DEV: gestor@empresa.com.br' }));
    await usuario.click(screen.getByRole('button', { name: 'Usar o padrão' }));
    expect(await screen.findByRole('button', { name: 'DEV: usuário padrão' })).toBeInTheDocument();
  });

  it('Entra ID: manda o token e oferece "Sair", sem seletor de usuário DEV', async () => {
    const usuario = userEvent.setup();
    const sair = vi.fn(() => Promise.resolve());
    const entra: AutenticacaoEntra = {
      modo: 'ENTRA',
      cabecalhos: () => Promise.resolve({ Authorization: 'Bearer token-teste' }),
      aoPerderSessao: vi.fn(),
      sair,
    };
    const { chamadas } = renderizarApp({
      autenticacao: entra,
      respostas: { '/me': { status: 200, corpo: sessaoDe('GESTOR') } },
    });
    await screen.findByRole('heading', { name: 'Olá, Julia' });
    expect(chamadas[0]?.cabecalhos.Authorization).toBe('Bearer token-teste');
    expect(screen.queryByRole('button', { name: /^DEV:/ })).not.toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Sair' }));
    expect(sair).toHaveBeenCalledOnce();
  });
});
