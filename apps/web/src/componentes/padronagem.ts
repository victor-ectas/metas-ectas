/**
 * Padronagem de apoio à marca (Manual da Identidade Visual da ECTAS, "padronagem de apoio a
 * marca"): fileiras de ondas em S soltas, cada fileira deslocada meia onda, como um mar visto de
 * cima. Desenhada aqui em SVG, como fundo CSS: decorativa, não chega aos leitores de tela.
 */

const LARGURA = 36;
const ALTURA = 24;

/** Uma onda em S de 24 px, com as pontas arredondadas, começando em (x, y). */
function onda(x: number, y: number, cor: string): string {
  return `<path d="M${String(x)} ${String(y)}c4-4 8-4 12 0s8 4 12 0" fill="none" stroke="${cor}" stroke-width="3.4" stroke-linecap="round"/>`;
}

/** Ladrilho com duas fileiras; a de baixo deslocada meia onda (e repetida na borda). */
function ladrilho(cor: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${String(LARGURA)}" height="${String(ALTURA)}" viewBox="0 0 ${String(LARGURA)} ${String(ALTURA)}">` +
    onda(3, 6, cor) +
    onda(21, 18, cor) +
    onda(-15, 18, cor) +
    `</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/**
 * Fundo com a padronagem na cor dada. A opacidade fica na cor (ex.: `rgba(...)`), para a
 * padronagem não esmaecer o que estiver por cima.
 */
export function padronagemOndas(cor: string): { backgroundImage: string; backgroundSize: string } {
  return {
    backgroundImage: ladrilho(cor),
    backgroundSize: `${String(LARGURA)}px ${String(ALTURA)}px`,
  };
}
