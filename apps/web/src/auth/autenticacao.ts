import { createContext, useContext } from 'react';

import type { ErroApi } from '../api/erro-api';

/**
 * Como a web se identifica para a API (CLAUDE.md 6). Duas implementações: Entra ID (MSAL, sempre
 * em produção) e modo DEV (só no servidor de desenvolvimento do Vite). A permissão é decidida
 * pela API; aqui só se obtém quem é o usuário.
 */
interface AutenticacaoBase {
  /** Cabeçalhos que identificam o usuário em cada requisição. */
  cabecalhos(): Promise<Record<string, string>>;
  /** A API respondeu 401. */
  aoPerderSessao(erro: ErroApi): void;
}

export interface AutenticacaoEntra extends AutenticacaoBase {
  readonly modo: 'ENTRA';
  /** Encerra a sessão no Entra ID e volta para a página inicial. */
  sair(): Promise<void>;
}

export interface AutenticacaoDev extends AutenticacaoBase {
  readonly modo: 'DEV';
  /** E-mail simulado; `null` usa o `AUTH_DEV_EMAIL` configurado na API. */
  usuarioDev(): string | null;
  trocarUsuarioDev(email: string | null): void;
}

export type Autenticacao = AutenticacaoEntra | AutenticacaoDev;

export const AutenticacaoContexto = createContext<Autenticacao | null>(null);

export function useAutenticacao(): Autenticacao {
  const autenticacao = useContext(AutenticacaoContexto);
  if (autenticacao === null) {
    throw new Error('useAutenticacao fora do AutenticacaoContexto.');
  }
  return autenticacao;
}
