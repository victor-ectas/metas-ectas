import type { Logger } from 'pino';

/** Pendências de um gestor no momento em que o mês fechou. */
export interface PendenciaGestor {
  readonly usuarioId: string;
  readonly nome: string;
  /** Variáveis dele ainda vazias no mês. */
  readonly pendentes: number;
  /** Variáveis ativas pelas quais ele responde no ciclo. */
  readonly total: number;
}

/** Mês que fechou (RN-34), com o retrato das pendências. */
export interface MesFechado {
  readonly cicloId: string;
  readonly ano: number;
  readonly mes: number;
  /** Instante do fechamento (23:59:59.999 do 15º dia útil de M+1, America/Sao_Paulo). */
  readonly fechouEm: string;
  readonly pendencias: readonly PendenciaGestor[];
  /** Variáveis vazias sem ninguém responsável por elas no ciclo. */
  readonly semResponsavel: number;
}

/** Reabertura que chegou à data-limite sem ser cancelada antes (RN-36). */
export interface ReaberturaVencida {
  readonly reaberturaId: string;
  readonly cicloId: string;
  readonly ano: number;
  readonly mes: number;
  readonly escopo: string;
  readonly escopoId: string | null;
  readonly validoAte: string;
}

/**
 * Avisos disparados pela rotina diária, depois de gravar o dia. Ponto de extensão dos e-mails da
 * Fase 2 (P30): lista de pendências à Diretoria quando um mês fecha, aviso de reabertura encerrada.
 */
export interface Notificador {
  mesFechado(fechamento: MesFechado): Promise<void>;
  reaberturaVencida(reabertura: ReaberturaVencida): Promise<void>;
}

/** Fase 1: sem e-mail. Só registra no log o que seria enviado (sem nomes nem e-mails). */
export class NotificadorSemEmail implements Notificador {
  constructor(private readonly logger: Logger) {}

  mesFechado(fechamento: MesFechado): Promise<void> {
    this.logger.info(
      {
        ano: fechamento.ano,
        mes: fechamento.mes,
        gestoresComPendencia: fechamento.pendencias.filter((p) => p.pendentes > 0).length,
        semResponsavel: fechamento.semResponsavel,
      },
      'Mês fechado (e-mail de pendências à Diretoria fica para a Fase 2)',
    );
    return Promise.resolve();
  }

  reaberturaVencida(reabertura: ReaberturaVencida): Promise<void> {
    this.logger.info(
      { reaberturaId: reabertura.reaberturaId, ano: reabertura.ano, mes: reabertura.mes },
      'Reabertura vencida: o mês voltou a fechar',
    );
    return Promise.resolve();
  }
}
