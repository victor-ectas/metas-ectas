import { Alert, Snackbar } from '@mui/material';
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';

interface Aviso {
  readonly id: number;
  readonly mensagem: string;
}

type Avisar = (mensagem: string) => void;

const AvisosContexto = createContext<Avisar | null>(null);

/**
 * Confirmação curta de uma ação concluída ("Usuário salvo."), no rodapé da tela. Fica num
 * `role="status"` (aria-live polite): o leitor de tela anuncia sem interromper.
 */
export function ProvedorAvisos(props: { readonly children: ReactNode }) {
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const avisar = useCallback<Avisar>((mensagem) => {
    setAviso({ id: Date.now(), mensagem });
  }, []);
  const valor = useMemo(() => avisar, [avisar]);
  return (
    <AvisosContexto.Provider value={valor}>
      {props.children}
      <Snackbar
        key={aviso?.id}
        open={aviso !== null}
        autoHideDuration={4000}
        onClose={(_evento, motivo) => {
          if (motivo !== 'clickaway') setAviso(null);
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ mb: 'env(safe-area-inset-bottom)' }}
      >
        <Alert
          severity="success"
          variant="filled"
          role="status"
          onClose={() => {
            setAviso(null);
          }}
          sx={{ width: '100%' }}
        >
          {aviso?.mensagem}
        </Alert>
      </Snackbar>
    </AvisosContexto.Provider>
  );
}

export function useAvisar(): Avisar {
  const avisar = useContext(AvisosContexto);
  if (avisar === null) throw new Error('useAvisar fora do ProvedorAvisos.');
  return avisar;
}
