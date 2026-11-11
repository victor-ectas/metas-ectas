import { describe, expect, it } from 'vitest';

import { NOME_PACOTE } from '../src/index.js';

describe('@metas/motor', () => {
  it('carrega o pacote', () => {
    expect(NOME_PACOTE).toBe('@metas/motor');
  });
});
