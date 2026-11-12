/** "1 setor" / "7 setores": escolhe a forma pela quantidade. */
export function plural(quantidade: number, singular: string, pluralizado: string): string {
  return `${String(quantidade)} ${quantidade === 1 ? singular : pluralizado}`;
}
