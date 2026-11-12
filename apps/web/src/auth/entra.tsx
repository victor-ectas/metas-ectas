import {
  type AuthenticationResult,
  InteractionRequiredAuthError,
  InteractionType,
  PublicClientApplication,
} from '@azure/msal-browser';
import { MsalAuthenticationTemplate, MsalProvider } from '@azure/msal-react';
import type { ReactNode } from 'react';

import { ErroApi } from '../api/erro-api';
import { TelaCarregando, TelaErro } from '../componentes/telas-estado';
import type { AutenticacaoEntra } from './autenticacao';

/**
 * Login pelo Entra ID com Authorization Code + PKCE (CLAUDE.md 3 e 6), por redirecionamento: em
 * celular, janelas pop-up são bloqueadas ou se perdem entre abas.
 */
export interface ConfigEntra {
  readonly clientId: string;
  readonly tenantId: string;
  readonly escopoApi: string;
}

export interface Entra {
  readonly instancia: PublicClientApplication;
  readonly autenticacao: AutenticacaoEntra;
}

/** Erro que não deve aparecer na tela: o navegador já está indo para o login da Microsoft. */
function redirecionando(): ErroApi {
  return new ErroApi('NAO_AUTENTICADO', 'Redirecionando para o login…', {
    motivo: 'REDIRECIONANDO',
  });
}

export async function iniciarEntra(config: ConfigEntra): Promise<Entra> {
  const escopos = [config.escopoApi];
  const instancia = new PublicClientApplication({
    auth: {
      clientId: config.clientId,
      authority: `https://login.microsoftonline.com/${config.tenantId}`,
      redirectUri: `${window.location.origin}/`,
      postLogoutRedirectUri: `${window.location.origin}/`,
    },
    // Padrão do MSAL: o token some ao fechar a aba. O login seguinte é silencioso enquanto a
    // sessão da Microsoft no navegador estiver válida.
    cache: { cacheLocation: 'sessionStorage' },
  });
  await instancia.initialize();

  // Volta do login: guarda a conta que acabou de entrar.
  const retorno = await instancia.handleRedirectPromise();
  const conta = retorno?.account ?? instancia.getActiveAccount() ?? instancia.getAllAccounts()[0];
  if (conta !== undefined) instancia.setActiveAccount(conta);

  async function obterToken(): Promise<AuthenticationResult> {
    const ativa = instancia.getActiveAccount();
    if (ativa === null) {
      await instancia.loginRedirect({ scopes: escopos });
      throw redirecionando();
    }
    try {
      return await instancia.acquireTokenSilent({ scopes: escopos, account: ativa });
    } catch (erro) {
      if (erro instanceof InteractionRequiredAuthError) {
        await instancia.acquireTokenRedirect({ scopes: escopos, account: ativa });
        throw redirecionando();
      }
      throw new ErroApi('NAO_AUTENTICADO', 'Não foi possível confirmar seu login. Entre de novo.');
    }
  }

  const autenticacao: AutenticacaoEntra = {
    modo: 'ENTRA',
    cabecalhos: async () => ({ Authorization: `Bearer ${(await obterToken()).accessToken}` }),
    aoPerderSessao: (erro) => {
      // Só o token vencido refaz o login sozinho. Outros 401 (ex.: audiência errada no registro
      // do aplicativo) aparecem na tela, para não entrar num ciclo de redirecionamentos.
      if (erro.motivo === 'TOKEN_EXPIRADO') {
        void instancia.acquireTokenRedirect({ scopes: escopos });
      }
    },
    sair: () => instancia.logoutRedirect({ account: instancia.getActiveAccount() }),
  };
  return { instancia, autenticacao };
}

/** Só mostra o sistema com uma conta logada; sem conta, vai direto para o login da Microsoft. */
export function PortaoEntra(props: {
  readonly entra: Entra;
  readonly escopoApi: string;
  readonly children: ReactNode;
}) {
  return (
    <MsalProvider instance={props.entra.instancia}>
      <MsalAuthenticationTemplate
        interactionType={InteractionType.Redirect}
        authenticationRequest={{ scopes: [props.escopoApi] }}
        loadingComponent={() => <TelaCarregando mensagem="Entrando com sua conta Microsoft…" />}
        errorComponent={({ error }) => (
          <TelaErro
            titulo="Não foi possível entrar"
            mensagem={`O login da Microsoft não foi concluído (${error?.errorCode ?? 'erro desconhecido'}).`}
            acao={{
              rotulo: 'Tentar de novo',
              aoClicar: () => {
                window.location.reload();
              },
            }}
          />
        )}
      >
        {props.children}
      </MsalAuthenticationTemplate>
    </MsalProvider>
  );
}
