import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { useId } from 'react';

/**
 * Confirmação de ação destrutiva (Web Interface Guidelines: nunca excluir direto). O botão diz
 * exatamente o que acontece ("Excluir setor"), e o erro da API aparece no próprio diálogo.
 */
export function DialogoConfirmacao(props: {
  readonly aberto: boolean;
  readonly titulo: string;
  readonly mensagem: string;
  readonly rotuloConfirmar: string;
  readonly aoConfirmar: () => void;
  readonly aoCancelar: () => void;
  readonly enviando?: boolean;
  readonly erro?: string | null;
}) {
  const idTitulo = useId();
  const idTexto = useId();
  return (
    <Dialog
      open={props.aberto}
      onClose={props.aoCancelar}
      aria-labelledby={idTitulo}
      aria-describedby={idTexto}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle id={idTitulo}>{props.titulo}</DialogTitle>
      <DialogContent>
        <DialogContentText id={idTexto}>{props.mensagem}</DialogContentText>
        {props.erro != null && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {props.erro}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={props.aoCancelar}>Cancelar</Button>
        <Button
          color="error"
          variant="contained"
          onClick={props.aoConfirmar}
          loading={props.enviando === true}
        >
          {props.rotuloConfirmar}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
