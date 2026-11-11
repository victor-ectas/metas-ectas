import type { PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

/**
 * Valida a entrada com um schema Zod (de `@metas/tipos`) e devolve o valor já convertido.
 * Erro de validação vira 400 `VALIDACAO` com os campos (filtro global).
 *
 * Uso: `@Body(new ValidacaoZod(MeuSchema)) dados: z.infer<typeof MeuSchema>`
 */
export class ValidacaoZod<T extends z.ZodType> implements PipeTransform<unknown, z.infer<T>> {
  constructor(private readonly schema: T) {}

  transform(valor: unknown): z.infer<T> {
    return this.schema.parse(valor);
  }
}
