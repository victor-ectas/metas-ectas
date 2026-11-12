import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router';

import { useSessao } from '../api/sessao';
import { itensDoUsuario, ROTULO_PERFIL } from '../app/menu';

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

/**
 * Início (especificação 10.2): por enquanto, quem é o usuário, o que ele vê e atalhos. Nota
 * parcial e pendências do mês entram com os lançamentos e resultados (P20).
 */
export function Inicio() {
  const { data: sessao } = useSessao();
  if (sessao === undefined) return null;
  const { usuario } = sessao;
  const atalhos = itensDoUsuario(usuario).filter((item) => item.caminho !== '/');

  return (
    <Stack spacing={3} sx={{ pt: 3, maxWidth: 960 }}>
      <Typography variant="h1">Olá, {primeiroNome(usuario.nome)}</Typography>

      {!usuario.ativo && (
        <Alert severity="warning">
          <AlertTitle>Seu acesso ainda não foi liberado</AlertTitle>O Administrador do sistema
          precisa ativar seu usuário e definir seu perfil. Avise-o informando o e-mail{' '}
          <strong>{usuario.email}</strong>.
        </Alert>
      )}

      <Card>
        <CardContent>
          <Typography variant="h2" gutterBottom>
            Seu acesso
          </Typography>
          <Box component="dl" sx={{ m: 0, display: 'grid', gap: 1.5 }}>
            <div>
              <Typography component="dt" variant="body2" color="text.secondary">
                Perfil
              </Typography>
              <Typography component="dd" sx={{ m: 0 }}>
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
                      <Chip key={setor.id} label={setor.nome} variant="outlined" />
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
          <Typography id="titulo-atalhos" variant="h2" gutterBottom>
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
              <Button
                key={item.caminho}
                component={RouterLink}
                to={item.caminho}
                variant="outlined"
                sx={{ justifyContent: 'flex-start', bgcolor: 'background.paper' }}
              >
                {item.rotulo}
              </Button>
            ))}
          </Box>
        </Box>
      )}
    </Stack>
  );
}
