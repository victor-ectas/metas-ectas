import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  ConsistenciaCicloSchema,
  GravidadeProblema,
  ProblemaConsistenciaSchema,
  TipoProblema,
} from '../src/index.js';

const problema = {
  tipo: 'PESOS_GESTOR',
  gravidade: 'BLOQUEIA',
  codigo: 'PESOS_INCONSISTENTES',
  mensagem: 'Julia Souza: Os pesos do bloco Departamental somam 90,00; deveriam somar 100,00.',
  metaId: null,
  metaCodigo: null,
  variavelId: null,
  setorId: null,
  usuarioId: randomUUID(),
};

describe('consistência do ciclo (P15)', () => {
  it('gravidades e tipos de problema', () => {
    expect(Object.values(GravidadeProblema)).toEqual(['BLOQUEIA', 'AVISO']);
    expect(Object.values(TipoProblema)).toContain('PESOS_GESTOR');
    expect(Object.values(TipoProblema)).toHaveLength(10);
  });

  it('problema do CT-17', () => {
    expect(ProblemaConsistenciaSchema.parse(problema)).toEqual(problema);
    expect(ProblemaConsistenciaSchema.safeParse({ ...problema, tipo: 'OUTRO' }).success).toBe(
      false,
    );
    expect(ProblemaConsistenciaSchema.safeParse({ ...problema, gravidade: 'ERRO' }).success).toBe(
      false,
    );
  });

  it('painel completo', () => {
    const painel = {
      ciclo: { id: randomUUID(), ano: 2027, status: 'RASCUNHO', encerradoEm: null },
      podeAtivar: false,
      motivoNaoAtivar: null,
      gestores: [
        {
          usuarioId: problema.usuarioId,
          nome: 'Julia Souza',
          ativo: true,
          corporativo: '0',
          departamental: '90',
          total: '90',
          comCorporativas: false,
          ok: false,
        },
      ],
      problemas: [problema],
      encerramento: {
        permitido: false,
        motivo: 'Só um ciclo ativo pode ser encerrado.',
        dezembroFechaEm: '2028-01-22T02:59:59.999Z',
      },
    };
    expect(ConsistenciaCicloSchema.parse(painel)).toEqual(painel);
  });
});
