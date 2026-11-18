import { Alert, AlertTitle, Box, ButtonBase, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Perfil } from '@metas/tipos';
import { Link as RouterLink } from 'react-router';

import { useSessao } from '../api/sessao';
import { ICONES } from '../app/icones';
import { itensDoUsuario } from '../app/menu';
import { CORES, MARCA, transparente } from '../app/tema';
import { padronagemOndas } from '../componentes/padronagem';
import { LARGURA_CONTEUDO, MARGEM_PAGINA, Pagina } from '../componentes/pagina';
import { PainelGestor } from './inicio-gestor';

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

/** O que cada perfil faz no sistema (CLAUDE.md 7.5), dito do ponto de vista de quem usa. */
const PAPEL: Readonly<Record<Perfil, string>> = {
  ADMIN: 'Cadastre ciclos, metas e usuários e acompanhe a nota de cada gestor.',
  DIRETORIA: 'Acompanhe os resultados e as notas de todos os gestores.',
  GESTOR: 'Lance os resultados de cada mês e acompanhe suas metas.',
  LEITOR: 'Consulte os resultados dos setores liberados para você.',
};

/**
 * Faixa de boas-vindas no azul da marca, com a padronagem de ondas do manual sumindo da direita
 * para a esquerda e o fio turquesa embaixo (o recorte de cores do uniforme da ECTAS).
 */
function FaixaBoasVindas(props: { readonly nome: string; readonly texto: string | null }) {
  return (
    <Box
      component="section"
      aria-labelledby="titulo-inicio"
      sx={{
        position: 'relative',
        overflow: 'hidden',
        bgcolor: MARCA.azul,
        color: MARCA.branco,
        borderBottom: `4px solid ${MARCA.turquesa}`,
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          ...padronagemOndas(alpha(MARCA.branco, 0.13)),
          maskImage: 'linear-gradient(to left, #000 10%, transparent 75%)',
          WebkitMaskImage: 'linear-gradient(to left, #000 10%, transparent 75%)',
          pointerEvents: 'none',
        },
      }}
    >
      <Box sx={{ position: 'relative', px: MARGEM_PAGINA, py: { xs: 4, md: 6 } }}>
        <Box sx={{ maxWidth: LARGURA_CONTEUDO }}>
          <Typography
            id="titulo-inicio"
            variant="h1"
            sx={{ fontSize: { xs: '2rem', md: '2.75rem' }, fontWeight: 300 }}
          >
            Olá, {props.nome}
          </Typography>
          {props.texto !== null && (
            <Typography sx={{ mt: 1.25, maxWidth: '52ch', color: alpha(MARCA.branco, 0.92) }}>
              {props.texto}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
}

/**
 * Início (especificação 10.2): quem é o usuário, o que ele vê e atalhos. O Gestor vê também a
 * nota parcial e as pendências dos meses com prazo correndo (P20); os outros perfis acompanham
 * todos os gestores na Visão geral (P26).
 */
export function Inicio() {
  const { data: sessao } = useSessao();
  if (sessao === undefined) return null;
  const { usuario } = sessao;
  // As Configurações ficam no menu, na seção Conta; os atalhos são das telas de trabalho.
  const atalhos = itensDoUsuario(usuario).filter(
    (item) => item.caminho !== '/' && item.caminho !== '/configuracoes',
  );

  return (
    <>
      <FaixaBoasVindas
        nome={primeiroNome(usuario.nome)}
        texto={usuario.ativo ? PAPEL[usuario.perfil] : null}
      />
      <Pagina>
        <Stack spacing={3}>
          {!usuario.ativo && (
            <Alert severity="warning">
              <AlertTitle>Seu acesso ainda não foi liberado</AlertTitle>O Administrador do sistema
              precisa ativar seu usuário e definir seu perfil. Avise-o informando o e-mail{' '}
              <strong>{usuario.email}</strong>.
            </Alert>
          )}

          {usuario.ativo && usuario.perfil === Perfil.GESTOR && (
            <PainelGestor usuarioId={usuario.id} />
          )}

          {atalhos.length > 0 && (
            <Box component="section" aria-labelledby="titulo-atalhos">
              <Typography id="titulo-atalhos" variant="h2" sx={{ mb: 2 }}>
                Atalhos
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gap: 1.5,
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
                }}
              >
                {atalhos.map((item) => (
                  <ButtonBase
                    key={item.caminho}
                    component={RouterLink}
                    to={item.caminho}
                    sx={{
                      justifyContent: 'flex-start',
                      gap: 1.5,
                      minHeight: 56,
                      px: 2,
                      borderRadius: 3,
                      border: `1px solid ${CORES.borda}`,
                      bgcolor: CORES.branco,
                      color: CORES.marinho,
                      fontWeight: 600,
                      fontSize: '0.9375rem',
                      textAlign: 'left',
                      transitionProperty: 'border-color, background-color',
                      transitionDuration: '150ms',
                      '&:hover': {
                        borderColor: CORES.azul,
                        bgcolor: transparente(CORES.turquesaClaro, 60),
                      },
                    }}
                  >
                    <Box
                      aria-hidden
                      sx={{
                        display: 'grid',
                        placeItems: 'center',
                        width: 36,
                        height: 36,
                        flexShrink: 0,
                        borderRadius: '50%',
                        bgcolor: CORES.turquesaClaro,
                        color: CORES.azul,
                        '& svg': { fontSize: 20 },
                      }}
                    >
                      {ICONES[item.caminho]}
                    </Box>
                    {item.rotulo}
                  </ButtonBase>
                ))}
              </Box>
            </Box>
          )}
        </Stack>
      </Pagina>
    </>
  );
}
