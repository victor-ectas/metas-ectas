import { Injectable } from '@nestjs/common';
import { Perfil } from '@metas/tipos';

import type { UsuarioAtual } from '../auth/usuario-atual.js';

/** O que a política precisa saber de uma meta para decidir quem a vê. */
export interface MetaParaAcesso {
  readonly setorId: string;
  readonly responsavelId: string;
  /** Usuários a quem a meta está atribuída (submeta não tem atribuição). */
  readonly atribuidos: readonly string[];
  /** Meta-mãe, quando é submeta. */
  readonly mae?: Omit<MetaParaAcesso, 'mae'> | null;
}

/** O que a política precisa saber de uma variável para decidir quem lança. */
export interface VariavelParaLancamento {
  /** Quem responde pelo lançamento: ver `responsavelPeloLancamento`. Nulo: ninguém definido. */
  readonly responsavelId: string | null;
}

/**
 * Responsável pelo lançamento de uma variável (RN-07): no Corporativo, o responsável da própria
 * variável; nos outros setores, o responsável pelo setor no ciclo.
 */
export function responsavelPeloLancamento(dados: {
  setorCorporativo: boolean;
  responsavelDaVariavel: string | null;
  responsavelDoSetorNoCiclo: string | null;
}): string | null {
  return dados.setorCorporativo ? dados.responsavelDaVariavel : dados.responsavelDoSetorNoCiclo;
}

/**
 * Serviço central de autorização (CLAUDE.md 6 e 7.5). Toda decisão de permissão passa por aqui;
 * controllers e serviços só perguntam. Usuário inativo não pode nada (só ver a própria sessão,
 * liberado no AuthGuard).
 *
 * As funções são puras: quem chama carrega os dados do recurso (`MetaParaAcesso` etc.).
 */
@Injectable()
export class PoliticasService {
  /** Usuário ativo com um dos perfis. Base do decorator `@Perfis(...)`. */
  temPerfil(usuario: UsuarioAtual, perfis: readonly Perfil[]): boolean {
    return usuario.ativo && perfis.includes(usuario.perfil);
  }

  /** Ciclos, setores, usuários, feriados, responsáveis e setores do Leitor. */
  podeEditarCadastros(usuario: UsuarioAtual): boolean {
    return this.temPerfil(usuario, [Perfil.ADMIN]);
  }

  /** Modelos, metas, variáveis, fórmulas e pesos. */
  podeEditarMetas(usuario: UsuarioAtual): boolean {
    return this.temPerfil(usuario, [Perfil.ADMIN]);
  }

  /** Administrador e Diretoria veem todas as metas, resultados e setores. */
  veTudo(usuario: UsuarioAtual): boolean {
    return this.temPerfil(usuario, [Perfil.ADMIN, Perfil.DIRETORIA]);
  }

  /**
   * Ver meta e resultados (7.5): Admin e Diretoria, todas; Gestor, as próprias (responsável) e
   * as atribuídas a ele; Leitor, as dos setores liberados. Submeta: visível também a quem vê a
   * meta-mãe.
   */
  podeVerMeta(usuario: UsuarioAtual, meta: MetaParaAcesso): boolean {
    if (this.veTudo(usuario)) return true;
    const regra = this.regraDeVisualizacao(usuario);
    if (regra === null) return false;
    return regra(meta) || (meta.mae != null && regra(meta.mae));
  }

  /** Histórico de alterações (7.5): Admin e Diretoria, todos; Gestor, das próprias metas; Leitor, não. */
  podeVerHistorico(usuario: UsuarioAtual, meta: MetaParaAcesso): boolean {
    if (this.veTudo(usuario)) return true;
    if (!this.temPerfil(usuario, [Perfil.GESTOR])) return false;
    return this.podeVerMeta(usuario, meta);
  }

  /**
   * Lançar variável (7.5, RN-06, RN-07): só o Gestor responsável pelo lançamento. A trava do mês
   * (RN-34) e a reabertura são verificadas à parte, no lançamento (P18). O Administrador lança só
   * em carga histórica (`podeFazerCargaHistorica`).
   */
  podeLancar(usuario: UsuarioAtual, variavel: VariavelParaLancamento): boolean {
    return this.temPerfil(usuario, [Perfil.GESTOR]) && variavel.responsavelId === usuario.id;
  }

  /** Carga histórica, ignorando a trava (RN-38): só o Administrador. */
  podeFazerCargaHistorica(usuario: UsuarioAtual): boolean {
    return this.temPerfil(usuario, [Perfil.ADMIN]);
  }

  private regraDeVisualizacao(
    usuario: UsuarioAtual,
  ): ((meta: Omit<MetaParaAcesso, 'mae'>) => boolean) | null {
    if (this.temPerfil(usuario, [Perfil.GESTOR])) {
      return (meta) => meta.responsavelId === usuario.id || meta.atribuidos.includes(usuario.id);
    }
    if (this.temPerfil(usuario, [Perfil.LEITOR])) {
      return (meta) => usuario.setoresLeitor.includes(meta.setorId);
    }
    return null;
  }
}
