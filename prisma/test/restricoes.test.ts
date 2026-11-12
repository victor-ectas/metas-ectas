import { describe, expect, it } from 'vitest';

import { SQLSTATE, usarBanco } from './banco.js';

type Id = { id: string };

describe('restrições do banco (CHECKs, únicos e triggers)', () => {
  const { sql, falha } = usarBanco();

  // ------------------------------------------------------------------------------------------
  // Dados de apoio, criados dentro da transação de cada teste
  // ------------------------------------------------------------------------------------------
  async function usuario(email = 'ana@empresa.com'): Promise<string> {
    const [linha] = await sql<Id>(
      'INSERT INTO usuario (nome, email) VALUES ($1, $2) RETURNING id',
      ['Ana', email],
    );
    return (linha as Id).id;
  }

  async function setor(codigo = 'RH', corporativo = false): Promise<string> {
    const [linha] = await sql<Id>(
      'INSERT INTO setor (codigo, nome, corporativo) VALUES ($1, $1, $2) RETURNING id',
      [codigo, corporativo],
    );
    return (linha as Id).id;
  }

  async function ciclo(ano = 2027): Promise<string> {
    const [linha] = await sql<Id>('INSERT INTO ciclo (ano) VALUES ($1) RETURNING id', [ano]);
    return (linha as Id).id;
  }

  interface Base {
    usuarioId: string;
    setorId: string;
    cicloId: string;
  }

  async function base(): Promise<Base> {
    return { usuarioId: await usuario(), setorId: await setor(), cicloId: await ciclo() };
  }

  const INSERIR_META = `
    INSERT INTO meta (ciclo_id, setor_id, meta_pai_id, codigo, indicador, metrica, unidade,
      formula_texto, formula_ast, modo_apuracao, operador, mes_inicio, mes_fim,
      regra_pontuacao, peso_interno, responsavel_id)
    VALUES ($1, $2, $3, $4, 'Indicador', 'Métrica', 'PERCENTUAL', 'A', '{}',
      'FORMULA_SOBRE_ACUMULADOS', 'GE', $5, $6, 'TUDO_OU_NADA', $7, $8)
    RETURNING id`;

  async function meta(
    b: Base,
    opcoes: {
      codigo?: string;
      pai?: string | null;
      inicio?: number;
      fim?: number;
      ciclo?: string;
    } = {},
  ): Promise<string> {
    const [linha] = await sql<Id>(INSERIR_META, [
      opcoes.ciclo ?? b.cicloId,
      b.setorId,
      opcoes.pai ?? null,
      opcoes.codigo ?? 'META',
      opcoes.inicio ?? 1,
      opcoes.fim ?? 12,
      opcoes.pai === undefined || opcoes.pai === null ? null : '0.5',
      b.usuarioId,
    ]);
    return (linha as Id).id;
  }

  // ------------------------------------------------------------------------------------------

  it('gera os ids no banco (gen_random_uuid)', async () => {
    expect(await usuario()).toMatch(/^[0-9a-f-]{36}$/);
  });

  describe('usuário e setor', () => {
    it('e-mail precisa estar em minúsculas e único', async () => {
      expect(
        (await falha("INSERT INTO usuario (nome, email) VALUES ('A', 'Ana@Empresa.com')"))
          .constraint,
      ).toBe('usuario_email_minusculo');
      await usuario('ana@empresa.com');
      expect(
        (await falha("INSERT INTO usuario (nome, email) VALUES ('B', 'ana@empresa.com')")).code,
      ).toBe(SQLSTATE.UNICO);
    });

    it('usuário nasce LEITOR inativo', async () => {
      const id = await usuario();
      const [linha] = await sql('SELECT perfil, ativo FROM usuario WHERE id = $1', [id]);
      expect(linha).toEqual({ perfil: 'LEITOR', ativo: false });
    });

    it('código do setor no formato das fórmulas', async () => {
      await setor('RH_2');
      for (const codigo of ['rh', '2RH', 'R H', 'RH.X', '']) {
        expect(
          (await falha('INSERT INTO setor (codigo, nome) VALUES ($1, $1)', [codigo])).constraint,
        ).toBe('setor_codigo_formato');
      }
    });

    it('no máximo um setor Corporativo', async () => {
      await setor('CORP', true);
      await setor('RH', false);
      await setor('FISCAL', false);
      const erro = await falha(
        "INSERT INTO setor (codigo, nome, corporativo) VALUES ('OUTRO', 'Outro', true)",
      );
      expect(erro).toMatchObject({ code: SQLSTATE.UNICO, constraint: 'setor_unico_corporativo' });
    });
  });

  describe('ciclo', () => {
    it('ano entre 2000 e 2100 e único', async () => {
      expect((await falha('INSERT INTO ciclo (ano) VALUES (1999)')).constraint).toBe('ciclo_ano');
      await ciclo(2027);
      expect((await falha('INSERT INTO ciclo (ano) VALUES (2027)')).code).toBe(SQLSTATE.UNICO);
    });

    it('no máximo um ciclo ATIVO (RF-07)', async () => {
      // Os testes da API usam o mesmo banco ao mesmo tempo e podem ter um ciclo ativo gravado:
      // dentro desta transação (desfeita no fim) ele vira rascunho, para o teste não depender disso.
      await sql("UPDATE ciclo SET status = 'RASCUNHO' WHERE status = 'ATIVO'");
      await sql("INSERT INTO ciclo (ano, status) VALUES (2026, 'ATIVO')");
      await sql("INSERT INTO ciclo (ano, status) VALUES (2025, 'RASCUNHO')");
      expect(await falha("INSERT INTO ciclo (ano, status) VALUES (2027, 'ATIVO')")).toMatchObject({
        code: SQLSTATE.UNICO,
        constraint: 'ciclo_unico_ativo',
      });
    });

    it('ciclo encerrado precisa da data de encerramento', async () => {
      expect(
        (await falha("INSERT INTO ciclo (ano, status) VALUES (2024, 'ENCERRADO')")).constraint,
      ).toBe('ciclo_encerrado_tem_data');
      await sql("INSERT INTO ciclo (ano, status, encerrado_em) VALUES (2024, 'ENCERRADO', now())");
    });
  });

  describe('variável', () => {
    const INSERIR = `INSERT INTO variavel (ciclo_id, setor_id, codigo, nome, tipo, acumulacao, casas_decimais)
      VALUES ($1, $2, $3, $3, 'NUMERO', 'SOMA', $4)`;

    it('código único por ciclo e setor; o mesmo código em outro setor é permitido', async () => {
      const b = await base();
      const fiscal = await setor('FISCAL');
      await sql(INSERIR, [b.cicloId, b.setorId, 'CHECKLISTS', 2]);
      await sql(INSERIR, [b.cicloId, fiscal, 'CHECKLISTS', 2]);
      expect((await falha(INSERIR, [b.cicloId, b.setorId, 'CHECKLISTS', 2])).code).toBe(
        SQLSTATE.UNICO,
      );
    });

    it('código no formato das fórmulas e casas decimais de 0 a 6', async () => {
      const b = await base();
      expect((await falha(INSERIR, [b.cicloId, b.setorId, 'checklists', 2])).constraint).toBe(
        'variavel_codigo_formato',
      );
      expect((await falha(INSERIR, [b.cicloId, b.setorId, 'X', 7])).constraint).toBe(
        'variavel_casas_decimais',
      );
      await sql(INSERIR, [b.cicloId, b.setorId, 'X', 0]);
    });
  });

  describe('meta', () => {
    it('período: mes_inicio entre 1 e 12, mes_fim entre mes_inicio e 12', async () => {
      const b = await base();
      for (const [inicio, fim] of [
        [0, 5],
        [1, 13],
        [6, 5],
      ]) {
        const erro = await falha(INSERIR_META, [
          b.cicloId,
          b.setorId,
          null,
          'M',
          inicio,
          fim,
          null,
          b.usuarioId,
        ]);
        expect(erro).toMatchObject({ code: SQLSTATE.CHECK, constraint: 'meta_periodo' });
      }
      await meta(b, { inicio: 5, fim: 5 });
    });

    it('fórmula: texto e AST juntos (ou os dois nulos, numa mãe que só agrega)', async () => {
      const b = await base();
      const id = await meta(b);
      expect(
        (await falha('UPDATE meta SET formula_ast = NULL WHERE id = $1', [id])).constraint,
      ).toBe('meta_formula_completa');
      await sql('UPDATE meta SET formula_ast = NULL, formula_texto = NULL WHERE id = $1', [id]);
    });

    it('tolerância ≥ 0, peso interno em (0, 1], versão ≥ 1, pai diferente de si mesma', async () => {
      const b = await base();
      const id = await meta(b);
      const casos: [string, string][] = [
        ['tolerancia = -0.01', 'meta_tolerancia'],
        ['peso_interno = 0', 'meta_peso_interno'],
        ['peso_interno = 1.5', 'meta_peso_interno'],
        ['versao = 0', 'meta_versao'],
        ['meta_pai_id = id', 'meta_pai_diferente'],
      ];
      for (const [atribuicao, constraint] of casos) {
        expect((await falha(`UPDATE meta SET ${atribuicao} WHERE id = $1`, [id])).constraint).toBe(
          constraint,
        );
      }
      await sql('UPDATE meta SET tolerancia = 0, peso_interno = 1 WHERE id = $1', [id]);
    });

    it('código único por ciclo', async () => {
      const b = await base();
      await meta(b, { codigo: 'M1' });
      expect(
        (await falha(INSERIR_META, [b.cicloId, b.setorId, null, 'M1', 1, 12, null, b.usuarioId]))
          .code,
      ).toBe(SQLSTATE.UNICO);
    });

    it('objetivo: mês 0 (único) a 12', async () => {
      const b = await base();
      const id = await meta(b);
      await sql(
        'INSERT INTO meta_objetivo (meta_id, mes, valor) VALUES ($1, 0, 0.8), ($1, 12, 1)',
        [id],
      );
      for (const mes of [-1, 13]) {
        expect(
          (
            await falha('INSERT INTO meta_objetivo (meta_id, mes, valor) VALUES ($1, $2, 1)', [
              id,
              mes,
            ])
          ).constraint,
        ).toBe('meta_objetivo_mes');
      }
    });

    it('atribuição: peso entre 0 (exclusive) e 100, um por gestor', async () => {
      const b = await base();
      const id = await meta(b);
      const INSERIR = 'INSERT INTO meta_atribuicao (meta_id, usuario_id, peso) VALUES ($1, $2, $3)';
      expect((await falha(INSERIR, [id, b.usuarioId, 0])).constraint).toBe('meta_atribuicao_peso');
      expect((await falha(INSERIR, [id, b.usuarioId, 100.01])).constraint).toBe(
        'meta_atribuicao_peso',
      );
      await sql(INSERIR, [id, b.usuarioId, 15]);
      expect((await falha(INSERIR, [id, b.usuarioId, 10])).code).toBe(SQLSTATE.UNICO);
    });
  });

  describe('trigger de 2 níveis (RN-26) e atribuição só em meta sem pai', () => {
    it('meta → submeta é permitido', async () => {
      const b = await base();
      const mae = await meta(b, { codigo: 'MAE' });
      await meta(b, { codigo: 'FILHA', pai: mae });
    });

    it('neto (submeta de submeta) é recusado', async () => {
      const b = await base();
      const mae = await meta(b, { codigo: 'MAE' });
      const filha = await meta(b, { codigo: 'FILHA', pai: mae });
      const erro = await falha(INSERIR_META, [
        b.cicloId,
        b.setorId,
        filha,
        'NETA',
        1,
        12,
        '0.5',
        b.usuarioId,
      ]);
      expect(erro).toMatchObject({
        code: SQLSTATE.CHECK,
        constraint: 'meta_dois_niveis',
        message: 'Uma submeta não pode ter submetas (máximo de 2 níveis)',
      });
    });

    it('meta com submetas não pode virar submeta de outra', async () => {
      const b = await base();
      const mae = await meta(b, { codigo: 'MAE' });
      await meta(b, { codigo: 'FILHA', pai: mae });
      const outra = await meta(b, { codigo: 'OUTRA' });
      const erro = await falha('UPDATE meta SET meta_pai_id = $1 WHERE id = $2', [outra, mae]);
      expect(erro).toMatchObject({ constraint: 'meta_dois_niveis' });
    });

    it('submeta precisa ser do mesmo ciclo da mãe', async () => {
      const b = await base();
      const mae = await meta(b, { codigo: 'MAE' });
      const outroCiclo = await ciclo(2028);
      const erro = await falha(INSERIR_META, [
        outroCiclo,
        b.setorId,
        mae,
        'FILHA',
        1,
        12,
        '0.5',
        b.usuarioId,
      ]);
      expect(erro).toMatchObject({ code: SQLSTATE.CHECK, constraint: 'meta_mesmo_ciclo' });
    });

    it('submeta não recebe atribuição', async () => {
      const b = await base();
      const mae = await meta(b, { codigo: 'MAE' });
      const filha = await meta(b, { codigo: 'FILHA', pai: mae });
      const erro = await falha(
        'INSERT INTO meta_atribuicao (meta_id, usuario_id, peso) VALUES ($1, $2, 10)',
        [filha, b.usuarioId],
      );
      expect(erro).toMatchObject({ code: SQLSTATE.CHECK, constraint: 'meta_atribuicao_sem_pai' });
    });

    it('meta com atribuição não pode virar submeta', async () => {
      const b = await base();
      const mae = await meta(b, { codigo: 'MAE' });
      const outra = await meta(b, { codigo: 'OUTRA' });
      await sql('INSERT INTO meta_atribuicao (meta_id, usuario_id, peso) VALUES ($1, $2, 10)', [
        outra,
        b.usuarioId,
      ]);
      const erro = await falha(
        'UPDATE meta SET meta_pai_id = $1, peso_interno = 0.5 WHERE id = $2',
        [mae, outra],
      );
      expect(erro).toMatchObject({ constraint: 'meta_atribuicao_sem_pai' });
    });
  });

  describe('lançamento e reabertura', () => {
    async function variavel(b: Base): Promise<string> {
      const [linha] = await sql<Id>(
        `INSERT INTO variavel (ciclo_id, setor_id, codigo, nome, tipo, acumulacao)
         VALUES ($1, $2, 'X', 'X', 'NUMERO', 'SOMA') RETURNING id`,
        [b.cicloId, b.setorId],
      );
      return (linha as Id).id;
    }

    it('lançamento: mês 1 a 12, um por variável e mês, valor nulo = vazio', async () => {
      const b = await base();
      const v = await variavel(b);
      const INSERIR =
        "INSERT INTO lancamento (variavel_id, mes, valor, origem) VALUES ($1, $2, $3, 'DIGITACAO')";
      for (const mes of [0, 13]) {
        expect((await falha(INSERIR, [v, mes, 1])).constraint).toBe('lancamento_mes');
      }
      await sql(INSERIR, [v, 1, null]);
      await sql(INSERIR, [v, 2, 0]);
      expect((await falha(INSERIR, [v, 1, 5])).code).toBe(SQLSTATE.UNICO);
      const linhas = await sql(
        'SELECT mes, valor FROM lancamento WHERE variavel_id = $1 ORDER BY mes',
        [v],
      );
      expect(linhas).toEqual([
        { mes: 1, valor: null },
        { mes: 2, valor: '0.000000' },
      ]);
    });

    it('reabertura: escopo TODOS sem id; SETOR e GESTOR com id; motivo e autorizador preenchidos', async () => {
      const b = await base();
      const INSERIR = `INSERT INTO reabertura (ciclo_id, mes, escopo, escopo_id, valido_ate, motivo, autorizado_por)
        VALUES ($1, $2, $3, $4, now(), $5, $6)`;
      await sql(INSERIR, [b.cicloId, 10, 'TODOS', null, 'Atraso no ERP', 'Gerente Geral']);
      await sql(INSERIR, [b.cicloId, 10, 'SETOR', b.setorId, 'Atraso', 'Gerente Geral']);
      expect((await falha(INSERIR, [b.cicloId, 10, 'TODOS', b.setorId, 'x', 'y'])).constraint).toBe(
        'reabertura_escopo_id',
      );
      expect((await falha(INSERIR, [b.cicloId, 10, 'GESTOR', null, 'x', 'y'])).constraint).toBe(
        'reabertura_escopo_id',
      );
      expect((await falha(INSERIR, [b.cicloId, 13, 'TODOS', null, 'x', 'y'])).constraint).toBe(
        'reabertura_mes',
      );
      expect((await falha(INSERIR, [b.cicloId, 10, 'TODOS', null, '  ', 'y'])).constraint).toBe(
        'reabertura_motivo',
      );
      expect((await falha(INSERIR, [b.cicloId, 10, 'TODOS', null, 'x', ''])).constraint).toBe(
        'reabertura_autorizado_por',
      );
    });
  });

  describe('histórico e auditoria: somente inclusão (RN-40)', () => {
    async function historico(): Promise<string> {
      const b = await base();
      const [v] = await sql<Id>(
        `INSERT INTO variavel (ciclo_id, setor_id, codigo, nome, tipo, acumulacao)
         VALUES ($1, $2, 'X', 'X', 'NUMERO', 'SOMA') RETURNING id`,
        [b.cicloId, b.setorId],
      );
      const [l] = await sql<Id>(
        "INSERT INTO lancamento (variavel_id, mes, valor, origem) VALUES ($1, 1, 5, 'DIGITACAO') RETURNING id",
        [(v as Id).id],
      );
      const [h] = await sql<Id>(
        `INSERT INTO lancamento_historico (lancamento_id, valor_anterior, valor_novo, origem, usuario_id)
         VALUES ($1, NULL, 5, 'DIGITACAO', $2) RETURNING id`,
        [(l as Id).id, b.usuarioId],
      );
      return (h as Id).id;
    }

    it('lancamento_historico aceita inclusão e recusa UPDATE, DELETE e TRUNCATE', async () => {
      const id = await historico();
      for (const [comando, op] of [
        ['UPDATE lancamento_historico SET valor_novo = 6 WHERE id = $1', 'UPDATE'],
        ['DELETE FROM lancamento_historico WHERE id = $1', 'DELETE'],
      ] as const) {
        expect(await falha(comando, [id])).toMatchObject({
          code: SQLSTATE.SEM_PRIVILEGIO,
          message: `A tabela lancamento_historico é somente inclusão: ${op} não é permitido`,
        });
      }
      expect((await falha('TRUNCATE lancamento_historico CASCADE')).message).toBe(
        'A tabela lancamento_historico é somente inclusão: TRUNCATE não é permitido',
      );
    });

    it('auditoria aceita inclusão e recusa UPDATE, DELETE e TRUNCATE', async () => {
      const [a] = await sql<Id>(
        `INSERT INTO auditoria (entidade, entidade_id, acao, antes, depois)
         VALUES ('meta', 'x', 'ALTERAR', '{"peso": 10}', '{"peso": 15}') RETURNING id`,
      );
      const id = (a as Id).id;
      expect((await falha('UPDATE auditoria SET acao = $2 WHERE id = $1', [id, 'X'])).code).toBe(
        SQLSTATE.SEM_PRIVILEGIO,
      );
      expect((await falha('DELETE FROM auditoria WHERE id = $1', [id])).code).toBe(
        SQLSTATE.SEM_PRIVILEGIO,
      );
      expect((await falha('TRUNCATE auditoria')).code).toBe(SQLSTATE.SEM_PRIVILEGIO);
    });

    it('lançamento com histórico não pode ser apagado', async () => {
      const id = await historico();
      const [{ lancamento_id }] = (await sql<{ lancamento_id: string }>(
        'SELECT lancamento_id FROM lancamento_historico WHERE id = $1',
        [id],
      )) as [{ lancamento_id: string }];
      expect((await falha('DELETE FROM lancamento WHERE id = $1', [lancamento_id])).code).toBe(
        // PostgreSQL 17 (produção): ON DELETE RESTRICT responde 23503; o 18 responderia 23001.
        SQLSTATE.CHAVE_ESTRANGEIRA,
      );
    });
  });

  it('atualizado_em é atualizado pelo banco em qualquer UPDATE', async () => {
    const [s] = await sql<Id>(
      "INSERT INTO setor (codigo, nome, atualizado_em) VALUES ('RH', 'RH', '2020-01-01T00:00:00Z') RETURNING id",
    );
    await sql("UPDATE setor SET nome = 'Recursos Humanos' WHERE id = $1", [(s as Id).id]);
    const [linha] = await sql<{ atualizado: boolean }>(
      'SELECT atualizado_em = now() AS atualizado FROM setor WHERE id = $1',
      [(s as Id).id],
    );
    expect(linha).toEqual({ atualizado: true });
  });
});
