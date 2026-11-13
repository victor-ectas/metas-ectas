import { type APIRequestContext, expect, type Page, test } from '@playwright/test';
import type { LancamentosMes } from '@metas/tipos';

import { ADMIN, AGORA, GESTOR, URL_API } from './ambiente';

/**
 * Fluxo da Entrega 1a (P21): o Gestor entra (modo DEV), lança o mês aberto, vê o resultado em
 * Minhas metas e não consegue lançar num mês fechado. Cenário em `preparar-banco.ts`; a API e o
 * navegador estão em 13/11/2026 (outubro aberto até 24/11, setembro fechado em 21/10).
 */

const CABECALHO_DEV = 'X-Usuario-Dev';

function comoUsuario(email: string) {
  return { headers: { [CABECALHO_DEV]: email } };
}

async function lancamentos(
  request: APIRequestContext,
  email: string,
  mes: number,
): Promise<LancamentosMes> {
  const resposta = await request.get(
    `${URL_API}/lancamentos?mes=${String(mes)}`,
    comoUsuario(email),
  );
  expect(resposta.status()).toBe(200);
  return (await resposta.json()) as LancamentosMes;
}

/**
 * Deixa outubro vazio e recalcula o ciclo, como Administrador (carga histórica). Assim cada
 * projeto (desktop e celular) começa do mesmo ponto, mesmo rodando um depois do outro.
 */
async function voltarAoCenario(request: APIRequestContext): Promise<void> {
  const outubro = await lancamentos(request, ADMIN.email, 10);
  const preenchidas = outubro.variaveis.filter((v) => v.valor !== null);
  if (preenchidas.length > 0) {
    const resposta = await request.put(`${URL_API}/lancamentos`, {
      ...comoUsuario(ADMIN.email),
      data: {
        ciclo: outubro.ciclo.id,
        itens: preenchidas.map((v) => ({
          variavelId: v.id,
          mes: 10,
          valor: null,
          versao: v.versao,
        })),
      },
    });
    expect(resposta.status()).toBe(200);
  }
  const recalculo = await request.post(
    `${URL_API}/ciclos/${outubro.ciclo.id}/recalcular`,
    comoUsuario(ADMIN.email),
  );
  expect(recalculo.status()).toBe(200);
}

/** Entra pelo seletor do modo DEV, como faria quem testa no navegador. */
async function entrarComo(page: Page, email: string, nome: string): Promise<void> {
  await page.clock.setFixedTime(new Date(AGORA));
  await page.goto('/');
  await page.getByRole('button', { name: /^DEV:/ }).click();
  await page.getByLabel('E-mail do usuário').fill(email);
  await page.getByRole('button', { name: 'Usar este' }).click();
  // O Início cumprimenta pelo primeiro nome.
  await expect(
    page.getByRole('heading', { name: `Olá, ${nome.split(' ')[0] ?? nome}` }),
  ).toBeVisible();
}

test.beforeEach(async ({ request }) => {
  await voltarAoCenario(request);
});

test('o Gestor lança o mês aberto e vê o resultado em Minhas metas', async ({ page }) => {
  await entrarComo(page, GESTOR.email, GESTOR.nome);

  // Início: outubro pendente e a nota parcial com janeiro e fevereiro (30/45 = 66,67%).
  const pendencias = page.getByRole('region', { name: 'Pendências' });
  await expect(pendencias).toContainText('Outubro/2026');
  await expect(pendencias).toContainText('Faltam 2 de 2 variáveis.');
  await expect(pendencias).toContainText('faltam 7 dias úteis');
  await expect(page.getByRole('region', { name: 'Nota parcial' })).toContainText('83,33');

  // Lançamentos de outubro.
  await pendencias.getByRole('link', { name: 'Lançar outubro' }).click();
  await expect(page).toHaveURL(/\/lancamentos\?mes=10$/);
  await expect(
    page.getByRole('status').filter({ hasText: 'Outubro/2026 fecha em 24/11' }),
  ).toBeVisible();
  await page.getByRole('textbox', { name: 'Requisições atendidas no prazo' }).fill('30');
  await page.getByRole('textbox', { name: 'Total de requisições' }).fill('30');

  // Prévia pelo motor no navegador, antes de salvar: (16+14+30)/(20+25+30) = 60/75 = 80,00%.
  const previa = page.getByRole('group', { name: 'Prévia de Requisições atendidas no prazo' });
  await expect(previa).toContainText('100,00%');
  await expect(previa).toContainText('80,00%');

  await page
    .getByRole('region', { name: 'Salvar lançamentos' })
    .getByRole('button', { name: 'Salvar 2 valores' })
    .click();
  await expect(page.getByText('2 valores salvos.')).toBeVisible();

  // Minhas metas: o resultado gravado pela API depois do recálculo.
  await page.goto('/minhas-metas');
  const meta = page.getByRole('link', { name: 'Requisições atendidas no prazo' });
  await expect(meta).toContainText('80,00%');
  await expect(meta).toContainText('Batida');
  await expect(page.getByRole('region', { name: /Nota/ }).first()).toContainText('100,00');

  // Detalhe com a memória de cálculo: 16 + 14 + 30 = 60 e 20 + 25 + 30 = 75.
  await meta.click();
  const memoria = page.getByRole('region', { name: 'Como foi calculado' });
  await expect(memoria).toContainText('REQ_ATENDIDOS / TOTAL_REQ');
  await expect(memoria).toContainText('60');
  await expect(memoria).toContainText('75');
});

test('mês fechado não aceita lançamento, nem pela tela nem pela API', async ({ page, request }) => {
  await entrarComo(page, GESTOR.email, GESTOR.nome);

  await page.goto('/lancamentos?mes=9');
  await expect(
    page.getByRole('status').filter({ hasText: 'Setembro/2026 fechou em 21/10/2026.' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Setembro, fechado' })).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: 'Requisições atendidas no prazo' }),
  ).toBeDisabled();
  await expect(page.getByRole('textbox', { name: 'Total de requisições' })).toBeDisabled();
  await expect(page.getByRole('region', { name: 'Salvar lançamentos' })).toHaveCount(0);

  // A trava é do servidor (RN-35): a gravação direta também é recusada.
  const setembro = await lancamentos(request, GESTOR.email, 9);
  const variavel = setembro.variaveis.find((v) => v.codigo === 'REQ_ATENDIDOS');
  expect(variavel).toBeDefined();
  const resposta = await request.put(`${URL_API}/lancamentos`, {
    ...comoUsuario(GESTOR.email),
    data: {
      ciclo: setembro.ciclo.id,
      itens: [{ variavelId: variavel?.id, mes: 9, valor: '10', versao: variavel?.versao }],
    },
  });
  expect(resposta.status()).toBe(422);
  expect(await resposta.json()).toMatchObject({ codigo: 'MES_FECHADO' });
});
