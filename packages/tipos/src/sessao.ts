/** Contrato de `GET /api/v1/me`: quem está logado e o que pode ver (especificação 10.1). */
import { z } from 'zod';

import { PerfilSchema } from './enums.js';
import { UuidSchema } from './schemas.js';

export const UsuarioSessaoSchema = z.object({
  id: UuidSchema,
  nome: z.string(),
  email: z.string(),
  perfil: PerfilSchema,
  /** Inativo: acabou de entrar pela 1ª vez ou foi desativado; só consegue ver a própria sessão. */
  ativo: z.boolean(),
  /** Diretoria que aprova pedidos de correção (Fase 2). */
  gerenteGeral: z.boolean(),
});
export type UsuarioSessao = z.infer<typeof UsuarioSessaoSchema>;

export const SetorSessaoSchema = z.object({
  id: UuidSchema,
  codigo: z.string(),
  nome: z.string(),
  corporativo: z.boolean(),
});
export type SetorSessao = z.infer<typeof SetorSessaoSchema>;

export const SessaoSchema = z.object({
  usuario: UsuarioSessaoSchema,
  /** Administrador e Diretoria veem todos os setores; nesse caso `setores` vem vazio. */
  todosOsSetores: z.boolean(),
  /** Gestor: setores pelos quais responde no ciclo ativo. Leitor: setores liberados a ele. */
  setores: z.array(SetorSessaoSchema),
});
export type Sessao = z.infer<typeof SessaoSchema>;
