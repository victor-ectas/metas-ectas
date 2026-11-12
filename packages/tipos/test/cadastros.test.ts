import { describe, expect, it } from 'vitest';

import {
  CicloEntradaSchema,
  CodigoSetorSchema,
  DataSchema,
  EmailSchema,
  FeriadoEntradaSchema,
  FiltroFeriadosSchema,
  FiltroUsuariosSchema,
  ListaUsuariosSchema,
  ResponsaveisEntradaSchema,
  SetorEntradaSchema,
  SetoresLeitorEntradaSchema,
  UsuarioEntradaSchema,
} from '../src/index.js';

const UUID_A = '7c0e4b8a-5f0f-4a43-9d1b-1f6a2b3c4d5e';
const UUID_B = 'a1b2c3d4-0000-4000-8000-000000000002';

function mensagens(resultado: { success: boolean; error?: { issues: { message: string }[] } }) {
  return resultado.error?.issues.map((problema) => problema.message) ?? [];
}

describe('UsuarioEntradaSchema', () => {
  it('aceita o mínimo e aplica os padrões', () => {
    expect(
      UsuarioEntradaSchema.parse({
        nome: ' Julia ',
        email: ' Julia@Ectas.com.br ',
        perfil: 'GESTOR',
      }),
    ).toEqual({
      nome: 'Julia',
      email: 'julia@ectas.com.br',
      perfil: 'GESTOR',
      ativo: true,
      gerenteGeral: false,
      superiorId: null,
    });
  });

  it('Gerente Geral só na Diretoria (pode haver vários)', () => {
    const base = { nome: 'Ana', email: 'ana@ectas.com.br', gerenteGeral: true };
    expect(UsuarioEntradaSchema.safeParse({ ...base, perfil: 'DIRETORIA' }).success).toBe(true);
    const gestor = UsuarioEntradaSchema.safeParse({ ...base, perfil: 'GESTOR' });
    expect(gestor.success).toBe(false);
    expect(gestor.error?.issues[0]?.path).toEqual(['gerenteGeral']);
    expect(mensagens(gestor)).toEqual(['Só quem tem o perfil Diretoria pode ser Gerente Geral.']);
  });

  it('recusa nome curto, e-mail inválido, perfil desconhecido e superior inválido', () => {
    const resultado = UsuarioEntradaSchema.safeParse({
      nome: 'A',
      email: 'sem-arroba',
      perfil: 'CHEFE',
      superiorId: 'x',
    });
    expect(mensagens(resultado)).toEqual(
      expect.arrayContaining([
        'O nome precisa ter ao menos 2 caracteres.',
        'E-mail inválido.',
        'Identificador inválido.',
      ]),
    );
  });

  it('e-mail longo demais', () => {
    expect(mensagens(EmailSchema.safeParse(`${'a'.repeat(250)}@x.com`))).toEqual([
      'O e-mail pode ter no máximo 254 caracteres.',
    ]);
  });
});

describe('FiltroUsuariosSchema', () => {
  it('converte a query string', () => {
    expect(FiltroUsuariosSchema.parse({ pagina: '2', ativo: 'false', perfil: 'LEITOR' })).toEqual({
      pagina: 2,
      tamanho: 50,
      ativo: false,
      perfil: 'LEITOR',
    });
    expect(FiltroUsuariosSchema.safeParse({ ativo: 'sim' }).success).toBe(false);
  });

  it('lista paginada', () => {
    expect(
      ListaUsuariosSchema.safeParse({ itens: [], total: 0, pagina: 1, tamanho: 50 }).success,
    ).toBe(true);
  });
});

describe('SetoresLeitorEntradaSchema', () => {
  it('remove repetidos', () => {
    expect(SetoresLeitorEntradaSchema.parse({ setorIds: [UUID_A, UUID_A, UUID_B] })).toEqual({
      setorIds: [UUID_A, UUID_B],
    });
  });
});

describe('setores', () => {
  it('código em maiúsculas, com letras, números e _', () => {
    expect(CodigoSetorSchema.parse(' rh ')).toBe('RH');
    expect(CodigoSetorSchema.parse('fiscal_2')).toBe('FISCAL_2');
    expect(CodigoSetorSchema.safeParse('2RH').success).toBe(false);
    expect(CodigoSetorSchema.safeParse('RH-1').success).toBe(false);
    expect(CodigoSetorSchema.safeParse('MANUTENÇÃO').success).toBe(false);
    expect(mensagens(CodigoSetorSchema.safeParse(''))).toEqual(['O código é obrigatório.']);
    expect(CodigoSetorSchema.safeParse('A'.repeat(31)).success).toBe(false);
  });

  it('padrões do setor', () => {
    expect(SetorEntradaSchema.parse({ codigo: 'qa', nome: 'Qualidade' })).toEqual({
      codigo: 'QA',
      nome: 'Qualidade',
      corporativo: false,
      ativo: true,
    });
  });
});

describe('ciclos e responsáveis', () => {
  it('ano entre 2000 e 2100', () => {
    expect(CicloEntradaSchema.safeParse({ ano: 2027 }).success).toBe(true);
    expect(mensagens(CicloEntradaSchema.safeParse({ ano: 1999 }))).toEqual([
      'O ano deve estar entre 2000 e 2100.',
    ]);
    expect(CicloEntradaSchema.safeParse({ ano: 2027.5 }).success).toBe(false);
  });

  it('responsáveis: setor uma vez só, null tira o responsável', () => {
    expect(
      ResponsaveisEntradaSchema.safeParse({
        responsaveis: [
          { setorId: UUID_A, usuarioId: UUID_B },
          { setorId: UUID_B, usuarioId: null },
        ],
      }).success,
    ).toBe(true);
    expect(
      mensagens(
        ResponsaveisEntradaSchema.safeParse({
          responsaveis: [
            { setorId: UUID_A, usuarioId: null },
            { setorId: UUID_A, usuarioId: UUID_B },
          ],
        }),
      ),
    ).toEqual(['Cada setor pode aparecer só uma vez.']);
    expect(mensagens(ResponsaveisEntradaSchema.safeParse({ responsaveis: [] }))).toEqual([
      'Informe ao menos um setor.',
    ]);
  });
});

describe('feriados', () => {
  it('data existente no formato aaaa-mm-dd', () => {
    expect(DataSchema.safeParse('2026-11-20').success).toBe(true);
    expect(DataSchema.safeParse('2028-02-29').success).toBe(true);
    expect(mensagens(DataSchema.safeParse('2027-02-29'))).toEqual([
      'Essa data não existe no calendário.',
    ]);
    expect(mensagens(DataSchema.safeParse('20/11/2026'))).toEqual([
      'Data inválida. Use o formato aaaa-mm-dd.',
    ]);
  });

  it('entrada e filtro', () => {
    expect(
      FeriadoEntradaSchema.parse({
        data: '2026-11-20',
        descricao: ' Consciência Negra ',
        tipo: 'NACIONAL',
      }),
    ).toEqual({ data: '2026-11-20', descricao: 'Consciência Negra', tipo: 'NACIONAL' });
    expect(
      FeriadoEntradaSchema.safeParse({ data: '2026-11-20', descricao: 'X', tipo: 'OUTRO' }).success,
    ).toBe(false);
    expect(FiltroFeriadosSchema.parse({ ano: '2027' })).toEqual({ ano: 2027 });
  });
});
