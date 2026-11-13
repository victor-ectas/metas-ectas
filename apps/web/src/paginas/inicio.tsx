import {
  Alert,
  AlertTitle,
  Box,
  ButtonBase,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Perfil } from '@metas/tipos';
import { Link as RouterLink } from 'react-router';

import { useSessao } from '../api/sessao';
import { ICONES } from '../app/icones';
import { itensDoUsuario, ROTULO_PERFIL } from '../app/menu';
import { CORES } from '../app/tema';
import simboloBranco from '../assets/ectas-simbolo-branco.png';
import { OndaBorda } from '../componentes/ondas';
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

/** Faixa de água no topo do Início, com a borda em ondas do site da ECTAS. */
function FaixaBoasVindas(props: { readonly nome: string; readonly texto: string | null }) {
  return (
    <Box
      component="section"
      aria-labelledby="titulo-inicio"
      sx={{ position: 'relative', overflow: 'hidden', bgcolor: CORES.azul, color: CORES.branco }}
    >
      {/* Marca d'água com as ondas do logotipo, como no site. */}
      <Box
        component="img"
        src={simboloBranco}
        alt=""
        width={282}
        height={192}
        sx={{
          position: 'absolute',
          right: { sm: -24, md: 48 },
          top: 8,
          opacity: 0.1,
          display: { xs: 'none', sm: 'block' },
          pointerEvents: 'none',
        }}
      />
      <Box sx={{ px: MARGEM_PAGINA, pt: { xs: 3, md: 5 }, pb: { xs: 1, md: 2 } }}>
        <Box sx={{ maxWidth: LARGURA_CONTEUDO, position: 'relative' }}>
          <Typography
            id="titulo-inicio"
            variant="h1"
            sx={{ fontSize: { xs: '1.625rem', md: '2.125rem' } }}
          >
            Olá, {props.nome}
          </Typography>
          {props.texto !== null && (
            <Typography sx={{ mt: 1, maxWidth: '52ch', color: alpha(CORES.branco, 0.9) }}>
              {props.texto}
            </Typography>
          )}
        </Box>
      </Box>
      <OndaBorda />
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
  const atalhos = itensDoUsuario(usuario).filter((item) => item.caminho !== '/');

  return (
    <>
      <FaixaBoasVindas
        nome={primeiroNome(usuario.nome)}
        texto={usuario.ativo ? PAPEL[usuario.perfil] : null}
      />
      <Pagina colada>
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

          <Box
            sx={{
              display: 'grid',
              gap: 3,
              gridTemplateColumns: { xs: '1fr', lg: atalhos.length > 0 ? '340px 1fr' : '1fr' },
              alignItems: 'start',
            }}
          >
            <Card component="section" aria-labelledby="titulo-acesso">
              <CardContent sx={{ p: 3 }}>
                <Typography id="titulo-acesso" variant="h2" sx={{ color: CORES.marinho, mb: 2 }}>
                  Seu acesso
                </Typography>
                <Box component="dl" sx={{ m: 0, display: 'grid', gap: 2 }}>
                  <div>
                    <Typography component="dt" variant="body2" color="text.secondary">
                      Perfil
                    </Typography>
                    <Typography component="dd" sx={{ m: 0, fontWeight: 600 }}>
                      {ROTULO_PERFIL[usuario.perfil]}
                      {usuario.gerenteGeral ? ' · Gerente Geral' : ''}
                      {usuario.ativo ? '' : ' (inativo)'}
                    </Typography>
                  </div>
                  <div>
                    <Typography component="dt" variant="body2" color="text.secondary">
                      E-mail
                    </Typography>
                    <Typography component="dd" sx={{ m: 0, overflowWrap: 'anywhere' }}>
                      {usuario.email}
                    </Typography>
                  </div>
                  <div>
                    <Typography component="dt" variant="body2" color="text.secondary">
                      Setores
                    </Typography>
                    <Box component="dd" sx={{ m: 0, pt: 0.5 }}>
                      {sessao.todosOsSetores ? (
                        <Typography>Todos os setores</Typography>
                      ) : sessao.setores.length === 0 ? (
                        <Typography color="text.secondary">Nenhum setor atribuído</Typography>
                      ) : (
                        <Stack direction="row" useFlexGap spacing={1} sx={{ flexWrap: 'wrap' }}>
                          {sessao.setores.map((setor) => (
                            <Chip
                              key={setor.id}
                              label={setor.nome}
                              sx={{ bgcolor: CORES.turquesaClaro, color: CORES.marinho }}
                            />
                          ))}
                        </Stack>
                      )}
                    </Box>
                  </div>
                </Box>
              </CardContent>
            </Card>

            {atalhos.length > 0 && (
              <Box component="section" aria-labelledby="titulo-atalhos">
                <Typography
                  id="titulo-atalhos"
                  variant="h2"
                  sx={{ color: CORES.marinho, mb: 2, mt: { lg: 0.5 } }}
                >
                  Atalhos
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gap: 1.5,
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' },
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
                          bgcolor: alpha(CORES.turquesaClaro, 0.4),
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
          </Box>
        </Stack>
      </Pagina>
    </>
  );
}
