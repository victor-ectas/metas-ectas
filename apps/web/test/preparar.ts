import '@testing-library/jest-dom/vitest';

import { cleanup, configure } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

// `findBy*`/`waitFor` esperam até 5 s (padrão: 1 s). A primeira montagem do sistema inteiro
// (rotas, MUI, consultas) passa de 1 s quando os 12 arquivos rodam em paralelo no Windows.
configure({ asyncUtilTimeout: 5_000 });

/**
 * O jsdom não calcula layout nem tem `matchMedia`. Este substituto responde às consultas de
 * largura (`min-width`/`max-width`) do MUI a partir de `window.innerWidth`, que cada teste define
 * com `definirLarguraTela`.
 */
function corresponde(consulta: string, largura: number): boolean {
  const minimo = /min-width:\s*([\d.]+)px/.exec(consulta);
  const maximo = /max-width:\s*([\d.]+)px/.exec(consulta);
  if (minimo?.[1] !== undefined && largura < Number(minimo[1])) return false;
  if (maximo?.[1] !== undefined && largura > Number(maximo[1])) return false;
  return true;
}

export function definirLarguraTela(largura: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: largura });
  // Sem `addListener`/`removeListener` (obsoletos): o MUI usa `addEventListener`.
  window.matchMedia = (consulta: string) =>
    ({
      matches: corresponde(consulta, largura),
      media: consulta,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

beforeEach(() => {
  definirLarguraTela(1440);
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});
