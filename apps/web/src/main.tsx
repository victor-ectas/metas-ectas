import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { App } from './app/app';
import { ProvedorTema } from './app/provedores';
import { TelaCarregando, TelaErro } from './componentes/telas-estado';
import { ConfigInvalida, lerConfig } from './config';

function mostrarErro(raiz: Root, titulo: string, mensagem: string): void {
  raiz.render(
    <ProvedorTema>
      <TelaErro titulo={titulo} mensagem={mensagem} />
    </ProvedorTema>,
  );
}

async function iniciar(): Promise<void> {
  const elemento = document.getElementById('raiz');
  if (elemento === null) throw new Error('Elemento #raiz ausente no index.html.');
  const raiz = createRoot(elemento);
  raiz.render(
    <ProvedorTema>
      <TelaCarregando />
    </ProvedorTema>,
  );

  let config;
  try {
    config = lerConfig(import.meta.env, import.meta.env.DEV);
  } catch (erro) {
    const problemas = erro instanceof ConfigInvalida ? erro.problemas.join(' ') : String(erro);
    mostrarErro(raiz, 'Sistema mal configurado', `Avise o Administrador. ${problemas}`);
    return;
  }

  // O modo DEV só existe no servidor de desenvolvimento: no build de produção `import.meta.env.DEV`
  // é `false`, e o Vite elimina este trecho e o módulo `auth/dev` do pacote final.
  if (import.meta.env.DEV && config.auth.modo === 'DEV') {
    const { criarAutenticacaoDev } = await import('./auth/dev');
    raiz.render(
      <StrictMode>
        <App apiUrl={config.apiUrl} autenticacao={criarAutenticacaoDev()} />
      </StrictMode>,
    );
    return;
  }

  if (config.auth.modo === 'ENTRA') {
    const { iniciarEntra, PortaoEntra } = await import('./auth/entra');
    const entra = await iniciarEntra(config.auth);
    raiz.render(
      <StrictMode>
        <ProvedorTema>
          <PortaoEntra entra={entra} escopoApi={config.auth.escopoApi}>
            <App apiUrl={config.apiUrl} autenticacao={entra.autenticacao} />
          </PortaoEntra>
        </ProvedorTema>
      </StrictMode>,
    );
  }
}

void iniciar().catch((erro: unknown) => {
  console.error(erro);
  const elemento = document.getElementById('raiz');
  if (elemento !== null) {
    elemento.textContent = 'Não foi possível iniciar o sistema. Recarregue a página.';
  }
});
