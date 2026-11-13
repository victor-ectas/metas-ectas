import { Perfil, type UsuarioSessao } from '@metas/tipos';

/**
 * Itens do menu (especificação 10.2, Fase 1). O menu só esconde o que o perfil não usa: quem
 * decide a permissão é a API (CLAUDE.md 2.2).
 */
export type Secao = 'GERAL' | 'ADMINISTRACAO';

export interface ItemMenu {
  readonly caminho: string;
  readonly rotulo: string;
  readonly secao: Secao;
  /** Perfis que veem o item; `null` = todos. */
  readonly perfis: readonly Perfil[] | null;
  /** Passo do plano (CLAUDE.md 10) em que a tela fica pronta; `null` = já pronta. */
  readonly passo: string | null;
}

const { ADMIN, DIRETORIA, GESTOR, LEITOR } = Perfil;

export const ITENS_MENU: readonly ItemMenu[] = [
  { caminho: '/', rotulo: 'Início', secao: 'GERAL', perfis: null, passo: null },
  {
    caminho: '/minhas-metas',
    rotulo: 'Minhas metas',
    secao: 'GERAL',
    perfis: [GESTOR],
    passo: 'P20',
  },
  {
    caminho: '/lancamentos',
    rotulo: 'Lançamentos',
    secao: 'GERAL',
    perfis: [GESTOR],
    passo: null,
  },
  {
    caminho: '/importacao',
    rotulo: 'Importar',
    secao: 'GERAL',
    perfis: [GESTOR, ADMIN],
    passo: 'P24',
  },
  {
    caminho: '/visao-geral',
    rotulo: 'Visão geral',
    secao: 'GERAL',
    perfis: [DIRETORIA, ADMIN, LEITOR],
    passo: 'P26',
  },
  { caminho: '/metas', rotulo: 'Metas', secao: 'ADMINISTRACAO', perfis: [ADMIN], passo: null },
  {
    caminho: '/variaveis',
    rotulo: 'Variáveis',
    secao: 'ADMINISTRACAO',
    perfis: [ADMIN],
    passo: null,
  },
  {
    caminho: '/modelos',
    rotulo: 'Catálogo de modelos',
    secao: 'ADMINISTRACAO',
    perfis: [ADMIN],
    passo: 'P25',
  },
  {
    caminho: '/ciclos',
    rotulo: 'Ciclos e consistência',
    secao: 'ADMINISTRACAO',
    perfis: [ADMIN],
    passo: null,
  },
  {
    caminho: '/fechamento',
    rotulo: 'Fechamento',
    secao: 'ADMINISTRACAO',
    perfis: [ADMIN],
    passo: 'P23',
  },
  {
    caminho: '/cadastros',
    rotulo: 'Cadastros',
    secao: 'ADMINISTRACAO',
    perfis: [ADMIN],
    passo: null,
  },
];

export const ROTULO_SECAO: Readonly<Record<Secao, string>> = {
  GERAL: 'Geral',
  ADMINISTRACAO: 'Administração',
};

export const ROTULO_PERFIL: Readonly<Record<Perfil, string>> = {
  ADMIN: 'Administrador',
  DIRETORIA: 'Diretoria',
  GESTOR: 'Gestor',
  LEITOR: 'Leitor',
};

/** Usuário inativo só vê o Início (a API só lhe responde `/me`, ADR-013). */
export function itensDoUsuario(usuario: UsuarioSessao): ItemMenu[] {
  return ITENS_MENU.filter(
    (item) => item.perfis === null || (usuario.ativo && item.perfis.includes(usuario.perfil)),
  );
}
