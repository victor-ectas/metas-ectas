import pg from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, expect } from 'vitest';

import { urlBancoTeste } from './ambiente.js';

/** Erro do PostgreSQL com o código SQLSTATE e a constraint violada. */
export interface ErroBanco {
  code: string;
  constraint?: string;
  message: string;
}

/**
 * Conexão de teste: cada teste roda numa transação desfeita no fim, então o banco de testes
 * não acumula dados. Use dentro de um `describe` (registra os hooks).
 */
export function usarBanco(url: () => string = urlBancoTeste): {
  sql: <T extends pg.QueryResultRow = pg.QueryResultRow>(
    texto: string,
    valores?: unknown[],
  ) => Promise<T[]>;
  falha: (texto: string, valores?: unknown[]) => Promise<ErroBanco>;
} {
  let cliente: pg.Client;

  beforeAll(async () => {
    cliente = new pg.Client({ connectionString: url() });
    await cliente.connect();
  });
  afterAll(async () => {
    await cliente.end();
  });
  beforeEach(async () => {
    await cliente.query('BEGIN');
  });
  afterEach(async () => {
    await cliente.query('ROLLBACK');
  });

  async function sql<T extends pg.QueryResultRow = pg.QueryResultRow>(
    texto: string,
    valores: unknown[] = [],
  ): Promise<T[]> {
    return (await cliente.query<T>(texto, valores)).rows;
  }

  /** Executa esperando erro; desfaz só o comando (savepoint) e devolve o erro. */
  async function falha(texto: string, valores: unknown[] = []): Promise<ErroBanco> {
    await cliente.query('SAVEPOINT antes_da_falha');
    try {
      await cliente.query(texto, valores);
    } catch (erro) {
      await cliente.query('ROLLBACK TO SAVEPOINT antes_da_falha');
      return erro as ErroBanco;
    }
    expect.fail(`Era esperado erro em: ${texto}`);
  }

  return { sql, falha };
}

/** Códigos SQLSTATE usados nos testes. */
export const SQLSTATE = {
  CHECK: '23514',
  UNICO: '23505',
  CHAVE_ESTRANGEIRA: '23503',
  RESTRITO: '23001',
  SEM_PRIVILEGIO: '42501',
} as const;
