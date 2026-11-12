import { Prisma } from '@metas/prisma';
import { CodigoErro } from '@metas/tipos';

import { ErroApi } from './erro-api.js';

/** Mensagem de cada índice único do banco, para o usuário entender o que já existe. */
const MENSAGENS_UNICIDADE: Readonly<Record<string, string>> = {
  usuario_email_key: 'Já existe um usuário com este e-mail.',
  usuario_entra_oid_key: 'Esta conta Microsoft já está ligada a outro usuário.',
  setor_codigo_key: 'Já existe um setor com este código.',
  setor_unico_corporativo: 'Já existe um setor Corporativo. Só pode haver um.',
  ciclo_ano_key: 'Já existe um ciclo para este ano.',
  ciclo_unico_ativo: 'Já existe um ciclo ativo. Só pode haver um por vez.',
  feriado_data_key: 'Já existe um feriado nesta data.',
};

/** Nome do índice ou da restrição que o PostgreSQL acusou (Prisma 7 com o adapter `pg`). */
function restricao(erro: Prisma.PrismaClientKnownRequestError): string | undefined {
  const meta = erro.meta as
    { driverAdapterError?: { cause?: { constraint?: { index?: string } } } } | undefined;
  return meta?.driverAdapterError?.cause?.constraint?.index;
}

/**
 * Traduz erros do banco em erros da API com mensagem em português:
 *
 * - unicidade (P2002) → `JA_EXISTE`, com a mensagem do índice;
 * - chave estrangeira (P2003) → `EM_USO`, com a mensagem de quem chama;
 * - registro não encontrado (P2025) → `NAO_ENCONTRADO`.
 *
 * Qualquer outro erro volta como veio (o filtro global o trata como erro interno).
 */
export function traduzirErroBanco(erro: unknown, mensagemEmUso: string): unknown {
  if (!(erro instanceof Prisma.PrismaClientKnownRequestError)) return erro;
  switch (erro.code) {
    case 'P2002': {
      const indice = restricao(erro);
      const mensagem = indice === undefined ? undefined : MENSAGENS_UNICIDADE[indice];
      // O nome do índice é detalhe interno do banco (CLAUDE.md 5.3): fica fora da resposta.
      return new ErroApi(CodigoErro.JA_EXISTE, mensagem ?? 'Este registro já existe.');
    }
    case 'P2003':
      return new ErroApi(CodigoErro.EM_USO, mensagemEmUso);
    case 'P2025':
      return new ErroApi(CodigoErro.NAO_ENCONTRADO, 'Registro não encontrado.');
    default:
      return erro;
  }
}
