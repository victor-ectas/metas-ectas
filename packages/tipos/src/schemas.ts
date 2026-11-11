/** Schemas Zod de base, reutilizados pelos DTOs da API e pelos formulários da web. */
import { z } from 'zod';

/** Mês de competência dentro do ciclo: 1 (janeiro) a 12 (dezembro). */
export const MesSchema = z
  .number({ error: 'O mês deve ser um número.' })
  .int({ error: 'O mês deve ser um número inteiro.' })
  .min(1, { error: 'O mês deve estar entre 1 e 12.' })
  .max(12, { error: 'O mês deve estar entre 1 e 12.' });
export type Mes = z.infer<typeof MesSchema>;

/** Mês de um objetivo de meta: 0 = objetivo único; 1 a 12 = objetivo daquele mês (RN-15). */
export const MES_OBJETIVO_UNICO = 0;
export const MesObjetivoSchema = z
  .number({ error: 'O mês do objetivo deve ser um número.' })
  .int({ error: 'O mês do objetivo deve ser um número inteiro.' })
  .min(0, { error: 'O mês do objetivo deve estar entre 0 (único) e 12.' })
  .max(12, { error: 'O mês do objetivo deve estar entre 0 (único) e 12.' });
export type MesObjetivo = z.infer<typeof MesObjetivoSchema>;

/** Limites de `numeric(18,6)` no banco: até 12 dígitos inteiros e 6 decimais. */
export const DECIMAL_DIGITOS_INTEIROS = 12;
export const DECIMAL_CASAS = 6;

const DECIMAL_FORMATO = /^-?\d+(\.\d+)?$/;

/**
 * Número decimal transportado como texto no JSON (CLAUDE.md 5.4), com ponto decimal:
 * `"1234.5"`, `"-0.25"`, `"0"`. Sem vírgula, sem separador de milhar, sem notação científica.
 * Precisa caber em `numeric(18,6)`. Percentuais vêm como fração (25% → `"0.25"`).
 * Vazio não é zero: campos opcionais usam `.nullable()` e gravam `null`.
 */
export const DecimalStringSchema = z
  .string({ error: 'O valor deve ser um texto com número decimal.' })
  .regex(DECIMAL_FORMATO, {
    error: 'Número decimal inválido. Use ponto como separador decimal, sem separador de milhar.',
  })
  .refine(
    (valor) => {
      const [inteira = ''] = valor.replace('-', '').split('.');
      return inteira.replace(/^0+(?=\d)/, '').length <= DECIMAL_DIGITOS_INTEIROS;
    },
    { error: `O número pode ter no máximo ${String(DECIMAL_DIGITOS_INTEIROS)} dígitos inteiros.` },
  )
  .refine((valor) => (valor.split('.')[1] ?? '').length <= DECIMAL_CASAS, {
    error: `O número pode ter no máximo ${String(DECIMAL_CASAS)} casas decimais.`,
  });
export type DecimalString = z.infer<typeof DecimalStringSchema>;

/** Identificador das tabelas de negócio. */
export const UuidSchema = z.uuid({ error: 'Identificador inválido.' });

/** Paginação de listas grandes (CLAUDE.md 5.2): `?pagina=1&tamanho=50`. Vem da query string. */
export const TAMANHO_PAGINA_PADRAO = 50;
export const TAMANHO_PAGINA_MAXIMO = 200;
export const PaginacaoSchema = z.object({
  pagina: z.coerce
    .number({ error: 'A página deve ser um número.' })
    .int({ error: 'A página deve ser um número inteiro.' })
    .min(1, { error: 'A página começa em 1.' })
    .default(1),
  tamanho: z.coerce
    .number({ error: 'O tamanho da página deve ser um número.' })
    .int({ error: 'O tamanho da página deve ser um número inteiro.' })
    .min(1, { error: 'O tamanho da página deve ser pelo menos 1.' })
    .max(TAMANHO_PAGINA_MAXIMO, {
      error: `O tamanho da página pode ser no máximo ${String(TAMANHO_PAGINA_MAXIMO)}.`,
    })
    .default(TAMANHO_PAGINA_PADRAO),
});
export type Paginacao = z.infer<typeof PaginacaoSchema>;
