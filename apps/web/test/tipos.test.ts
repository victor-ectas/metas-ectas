import { CodigoErro, MesSchema, Perfil } from '@metas/tipos';
import { describe, expect, it } from 'vitest';

describe('importa @metas/tipos', () => {
  it('usa enums, códigos de erro e schemas', () => {
    expect(Perfil.GESTOR).toBe('GESTOR');
    expect(CodigoErro.MES_FECHADO).toBe('MES_FECHADO');
    expect(MesSchema.safeParse(13).success).toBe(false);
  });
});
