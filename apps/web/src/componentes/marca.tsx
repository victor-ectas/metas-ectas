import { Box, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';

import nomeBranco from '../assets/ectas-nome-branco.png';
import simboloBranco from '../assets/ectas-simbolo-branco.png';
import simbolo from '../assets/ectas-simbolo.png';
import { MARCA } from '../app/tema';

/**
 * Logotipo da ECTAS a partir do arquivo oficial do site (ADR-015). As imagens têm o dobro do
 * tamanho exibido, para ficarem nítidas em telas de alta densidade.
 */

/**
 * Símbolo das três ondas para a área de conteúdo (ex.: tela de carregamento): colorido no claro e
 * branco no escuro (o manual não aplica a logo sem contraste).
 */
export function SimboloEctas(props: { readonly altura: number; readonly decorativo?: boolean }) {
  const escuro = useTheme().palette.mode === 'dark';
  const largura = Math.round((props.altura * 283) / 192);
  return (
    <img
      src={escuro ? simboloBranco : simbolo}
      width={largura}
      height={props.altura}
      alt={props.decorativo === true ? '' : 'ECTAS Saneamento'}
      style={{ display: 'block' }}
    />
  );
}

/** Logotipo em branco + nome do sistema, para o marinho do menu e da barra no celular. */
export function MarcaEctas(props: { readonly compacta?: boolean }) {
  const alturaSimbolo = props.compacta === true ? 26 : 34;
  const alturaNome = props.compacta === true ? 15 : 19;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }} translate="no">
      <img
        src={simboloBranco}
        width={Math.round((alturaSimbolo * 188) / 128)}
        height={alturaSimbolo}
        alt=""
        style={{ display: 'block', flexShrink: 0 }}
      />
      <Box sx={{ display: 'grid', gap: 0.5, minWidth: 0 }}>
        <img
          src={nomeBranco}
          width={Math.round((alturaNome * 305) / 64)}
          height={alturaNome}
          alt="ECTAS"
          style={{ display: 'block' }}
        />
        <Typography
          component="span"
          sx={{
            color: MARCA.turquesa,
            fontSize: props.compacta === true ? 11 : 12,
            fontWeight: 600,
            lineHeight: 1,
            letterSpacing: '0.04em',
            whiteSpace: 'nowrap',
          }}
        >
          Gestão de Metas
        </Typography>
      </Box>
    </Box>
  );
}
