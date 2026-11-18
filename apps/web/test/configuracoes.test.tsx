import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { definirPreferencias, recarregarPreferencias } from '../src/app/preferencias';
import { definirAparelhoEscuro } from './preparar';
import { renderizarApp, sessaoDe } from './utilitarios';

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

/** Valor de uma variável de cor no `:root` do tema em uso (CssBaseline). */
function variavelNoRoot(nome: string): string | null {
  const css = [...document.querySelectorAll('style')].map((s) => s.textContent).join('\n');
  const encontradas = [...css.matchAll(new RegExp(`${nome}:\\s*([^;}]+)`, 'g'))];
  return encontradas.at(-1)?.[1]?.trim() ?? null;
}

function abrir(perfil: Parameters<typeof sessaoDe>[0], extra: Parameters<typeof sessaoDe>[1] = {}) {
  return renderizarApp({
    caminho: '/configuracoes',
    respostas: { '/me': { status: 200, corpo: sessaoDe(perfil, extra) } },
  });
}

describe('Configurações: aparência', () => {
  it('começa no automático, seguindo o aparelho (claro)', async () => {
    abrir('GESTOR');
    const tema = await screen.findByRole('radiogroup', { name: 'Tema' });
    expect(within(tema).getByRole('radio', { name: /Automático/ })).toBeChecked();
    expect(screen.getByText('Agora: claro, como o seu aparelho.')).toBeInTheDocument();
    expect(variavelNoRoot('--ectas-espuma')).toBe('#F5F9FA');
  });

  it('no automático, com o aparelho no escuro, o sistema fica escuro', async () => {
    definirAparelhoEscuro(true);
    abrir('GESTOR');
    expect(await screen.findByText('Agora: escuro, como o seu aparelho.')).toBeInTheDocument();
    expect(variavelNoRoot('--ectas-espuma')).toBe('#0B1620');
  });

  it('escolher Escuro troca o tema na hora e guarda neste aparelho', async () => {
    const usuario = userEvent.setup();
    abrir('GESTOR');
    const tema = await screen.findByRole('radiogroup', { name: 'Tema' });
    await usuario.click(within(tema).getByRole('radio', { name: /Escuro/ }));

    expect(within(tema).getByRole('radio', { name: /Escuro/ })).toBeChecked();
    expect(screen.getByText('Agora: escuro.')).toBeInTheDocument();
    expect(variavelNoRoot('--ectas-espuma')).toBe('#0B1620');
    expect(JSON.parse(localStorage.getItem('metas.preferencias') ?? '{}')).toEqual({
      tema: 'ESCURO',
      reduzirMovimento: false,
    });
  });

  it('Claro vale mesmo com o aparelho no escuro', async () => {
    definirAparelhoEscuro(true);
    definirPreferencias({ tema: 'CLARO' });
    abrir('LEITOR');
    expect(await screen.findByText('Agora: claro.')).toBeInTheDocument();
    expect(variavelNoRoot('--ectas-espuma')).toBe('#F5F9FA');
  });

  it('reduzir movimento fica guardado e desliga as animações', async () => {
    const usuario = userEvent.setup();
    abrir('GESTOR');
    const interruptor = await screen.findByRole('switch', { name: 'Reduzir movimento' });
    expect(interruptor).not.toBeChecked();
    await usuario.click(interruptor);
    expect(interruptor).toBeChecked();
    expect(JSON.parse(localStorage.getItem('metas.preferencias') ?? '{}')).toMatchObject({
      reduzirMovimento: true,
    });
    // Regra global do tema: sem animações nem transições.
    const css = [...document.querySelectorAll('style')].map((e) => e.textContent).join('');
    expect(css.replace(/\s/g, '')).toContain('animation-duration:0.01ms!important');
  });

  it('preferência guardada com valor estranho volta ao padrão', async () => {
    localStorage.setItem('metas.preferencias', '{"tema":"ROXO","reduzirMovimento":"sim"}');
    recarregarPreferencias();
    abrir('GESTOR');
    const tema = await screen.findByRole('radiogroup', { name: 'Tema' });
    expect(within(tema).getByRole('radio', { name: /Automático/ })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Reduzir movimento' })).not.toBeChecked();
  });
});

describe('Configurações: minha conta e sobre o sistema', () => {
  it('Gestor vê nome, perfil, e-mail e setores', async () => {
    abrir('GESTOR', { setores: SETORES });
    const conta = await screen.findByRole('region', { name: 'Minha conta' });
    expect(within(conta).getByText('Julia Martins Souza')).toBeInTheDocument();
    expect(within(conta).getByText('Gestor')).toBeInTheDocument();
    expect(within(conta).getByText('julia@empresa.com.br')).toBeInTheDocument();
    expect(within(conta).getByText('Recursos Humanos')).toBeInTheDocument();
    expect(within(conta).getByText('Tecnologia')).toBeInTheDocument();
  });

  it('Administrador vê todos os setores; Leitor sem setores vê o aviso', async () => {
    abrir('ADMIN');
    expect(await screen.findByText('Todos os setores')).toBeInTheDocument();
  });

  it('Leitor sem setores liberados', async () => {
    abrir('LEITOR');
    expect(await screen.findByText('Nenhum setor atribuído')).toBeInTheDocument();
  });

  it('usuário inativo também chega às Configurações e vê a situação da conta', async () => {
    const corpo = sessaoDe('LEITOR', { ativo: false });
    corpo.usuario.gerenteGeral = true;
    renderizarApp({ caminho: '/configuracoes', respostas: { '/me': { status: 200, corpo } } });
    expect(await screen.findByText('Leitor · Gerente Geral (inativo)')).toBeInTheDocument();
  });

  it('sobre o sistema mostra a versão, o ambiente e o login', async () => {
    abrir('DIRETORIA');
    const sobre = await screen.findByRole('region', { name: 'Sobre o sistema' });
    expect(within(sobre).getByText('Desenvolvimento')).toBeInTheDocument();
    expect(within(sobre).getByText('Simulado (modo de desenvolvimento)')).toBeInTheDocument();
    expect(within(sobre).getByText(__VERSAO_WEB__.commit)).toBeInTheDocument();
  });
});
