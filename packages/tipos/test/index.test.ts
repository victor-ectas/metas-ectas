import { describe, expect, it } from 'vitest';

import { NOME_PACOTE } from '../src/index';

describe('@metas/tipos', () => {
  it('carrega o pacote', () => {
    expect(NOME_PACOTE).toBe('@metas/tipos');
  });
});
