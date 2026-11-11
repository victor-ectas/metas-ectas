import { SetMetadata } from '@nestjs/common';
import type { Perfil } from '@metas/tipos';

export const CHAVE_PUBLICA = 'metas:publica';
export const CHAVE_PERMITE_INATIVO = 'metas:permite-inativo';
export const CHAVE_PERFIS = 'metas:perfis';

/** Rota sem autenticação (só a saúde). Toda outra rota exige login (especificação 10). */
export const Publica = () => SetMetadata(CHAVE_PUBLICA, true);

/** Rota acessível a usuário inativo (só `GET /me`, para a web mostrar que o acesso aguarda liberação). */
export const PermiteInativo = () => SetMetadata(CHAVE_PERMITE_INATIVO, true);

/**
 * Restringe a rota a perfis. A decisão passa pelo PoliticasService (`temPerfil`); regras que
 * dependem do recurso (meta, variável) são verificadas no serviço, com o PoliticasService.
 */
export const Perfis = (...perfis: Perfil[]) => SetMetadata(CHAVE_PERFIS, perfis);
