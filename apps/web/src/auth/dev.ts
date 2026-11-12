import type { AutenticacaoDev } from './autenticacao';

/**
 * Modo DEV de autenticação (CLAUDE.md 6): a API simula o usuário pelo cabeçalho `X-Usuario-Dev`,
 * aceito só com `NODE_ENV=development` e `AUTH_DEV=true`. Este módulo só é carregado pelo
 * servidor de desenvolvimento do Vite; o build de produção não o inclui (ver `main.tsx`).
 */
export const CABECALHO_USUARIO_DEV = 'X-Usuario-Dev';
const CHAVE_ARMAZENAMENTO = 'metas.usuarioDev';

/** O armazenamento pode faltar ou falhar (janela privada, bloqueio): o modo DEV segue sem ele. */
function ler(armazenamento: Storage | undefined): string | null {
  try {
    return armazenamento?.getItem(CHAVE_ARMAZENAMENTO) ?? null;
  } catch {
    return null;
  }
}

function gravar(armazenamento: Storage | undefined, email: string | null): void {
  try {
    if (email === null) armazenamento?.removeItem(CHAVE_ARMAZENAMENTO);
    else armazenamento?.setItem(CHAVE_ARMAZENAMENTO, email);
  } catch {
    // Sem armazenamento, a escolha vale só até recarregar a página.
  }
}

export function criarAutenticacaoDev(
  armazenamento: Storage | undefined = globalThis.localStorage,
): AutenticacaoDev {
  let usuario = ler(armazenamento);
  return {
    modo: 'DEV',
    cabecalhos: () => {
      const cabecalhos: Record<string, string> = {};
      if (usuario !== null) cabecalhos[CABECALHO_USUARIO_DEV] = usuario;
      return Promise.resolve(cabecalhos);
    },
    // Sem login a refazer: o erro aparece na tela (ex.: e-mail simulado que não existe no banco).
    aoPerderSessao: () => undefined,
    usuarioDev: () => usuario,
    trocarUsuarioDev: (email) => {
      const limpo = email?.trim().toLowerCase() ?? '';
      usuario = limpo === '' ? null : limpo;
      gravar(armazenamento, usuario);
    },
  };
}
