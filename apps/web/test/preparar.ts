import '@testing-library/jest-dom/vitest';

import { cleanup, configure } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

import { recarregarPreferencias } from '../src/app/preferencias';

// `findBy*`/`waitFor` esperam até 5 s (padrão: 1 s). A primeira montagem do sistema inteiro
// (rotas, MUI, consultas) passa de 1 s quando os 12 arquivos rodam em paralelo no Windows.
configure({ asyncUtilTimeout: 5_000 });

/**
 * O jsdom não calcula layout nem tem `matchMedia`. Este substituto responde às consultas de
 * largura (`min-width`/`max-width`) do MUI a partir de `window.innerWidth`, que cada teste define
 * com `definirLarguraTela`.
 */
let aparelhoEscuro = false;

/** Simula o aparelho em modo escuro (`prefers-color-scheme: dark`). Volta ao claro a cada teste. */
export function definirAparelhoEscuro(escuro: boolean): void {
  aparelhoEscuro = escuro;
  definirLarguraTela(window.innerWidth);
}

function corresponde(consulta: string, largura: number): boolean {
  if (consulta.includes('prefers-color-scheme')) {
    return consulta.includes('dark') === aparelhoEscuro;
  }
  // Aparelho sem pedido de menos movimento.
  if (consulta.includes('prefers-reduced-motion')) return consulta.includes('no-preference');
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
  aparelhoEscuro = false;
  definirLarguraTela(1440);
  localStorage.clear();
  recarregarPreferencias();
});

afterEach(() => {
  cleanup();
});
