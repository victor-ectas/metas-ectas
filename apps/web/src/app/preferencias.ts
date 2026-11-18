import { useMediaQuery } from '@mui/material';
import { useSyncExternalStore } from 'react';
import { z } from 'zod';

import type { ModoTema } from './tema';

/**
 * Preferências de aparência de quem usa o sistema, guardadas neste aparelho (navegador), como
 * decidido pelo desenvolvedor (ADR-030): cada pessoa escolhe no celular e no computador. Um
 * armazenamento só para o app inteiro, para todos os provedores de tema (e as outras abas)
 * mudarem juntos.
 */

export const ESCOLHAS_TEMA = ['AUTOMATICO', 'CLARO', 'ESCURO'] as const;
export type EscolhaTema = (typeof ESCOLHAS_TEMA)[number];

const PreferenciasSchema = z.object({
  tema: z.enum(ESCOLHAS_TEMA).catch('AUTOMATICO'),
  reduzirMovimento: z.boolean().catch(false),
});
export type Preferencias = z.infer<typeof PreferenciasSchema>;

export const PREFERENCIAS_PADRAO: Preferencias = { tema: 'AUTOMATICO', reduzirMovimento: false };

const CHAVE = 'metas.preferencias';

/** O armazenamento pode faltar ou falhar (janela privada, bloqueio): vale o padrão. */
function ler(): Preferencias {
  try {
    const bruto = globalThis.localStorage.getItem(CHAVE);
    if (bruto === null) return PREFERENCIAS_PADRAO;
    const lido = PreferenciasSchema.safeParse(JSON.parse(bruto));
    return lido.success ? lido.data : PREFERENCIAS_PADRAO;
  } catch {
    return PREFERENCIAS_PADRAO;
  }
}

let atual: Preferencias | null = null;
const ouvintes = new Set<() => void>();

function avisar(): void {
  for (const ouvinte of ouvintes) ouvinte();
}

function obter(): Preferencias {
  atual ??= ler();
  return atual;
}

function assinar(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  // Outra aba mudou a preferência: relê e avisa.
  const aoMudarEmOutraAba = (evento: StorageEvent) => {
    if (evento.key !== null && evento.key !== CHAVE) return;
    atual = ler();
    avisar();
  };
  globalThis.addEventListener('storage', aoMudarEmOutraAba);
  return () => {
    ouvintes.delete(ouvinte);
    globalThis.removeEventListener('storage', aoMudarEmOutraAba);
  };
}

/** Grava uma ou mais preferências e atualiza todo o app. */
export function definirPreferencias(alteracao: Partial<Preferencias>): void {
  atual = { ...obter(), ...alteracao };
  try {
    globalThis.localStorage.setItem(CHAVE, JSON.stringify(atual));
  } catch {
    // Sem armazenamento, a escolha vale até recarregar a página.
  }
  avisar();
}

/** Esquece a leitura em memória (testes, que limpam o `localStorage` entre um e outro). */
export function recarregarPreferencias(): void {
  atual = null;
  avisar();
}

export function usePreferencias(): Preferencias {
  return useSyncExternalStore(assinar, obter, () => PREFERENCIAS_PADRAO);
}

/** Modo em uso: o escolhido, ou o do aparelho quando a escolha é automática. */
export function useModoTema(): ModoTema {
  const { tema } = usePreferencias();
  const aparelhoEscuro = useMediaQuery('(prefers-color-scheme: dark)', { noSsr: true });
  if (tema === 'CLARO') return 'claro';
  if (tema === 'ESCURO') return 'escuro';
  return aparelhoEscuro ? 'escuro' : 'claro';
}
