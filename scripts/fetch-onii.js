'use strict';

/**
 * fetch-onii.js
 * ─────────────────────────────────────────────
 * Responsável por:
 *   1. Abrir o browser (Playwright) e fazer login no Onii
 *   2. Capturar o Bearer token dos headers de requisição
 *   3. Fechar o browser
 *   4. Chamar a API REST diretamente para cada loja + período
 *   5. Retornar os dados brutos para transform-sales.js
 * ─────────────────────────────────────────────
 */

require('dotenv').config();
const https   = require('https');
const { chromium } = require('playwright');

// ─── Configuração ────────────────────────────────────────────────────────────

const CONFIG = {
  loginUrl: 'https://merchant.onii.app',
  apiHost:  'platform.onii.com.br',
  email:    process.env.ONII_EMAIL    || '',
  password: process.env.ONII_PASSWORD || '',
  headless: process.env.HEADLESS !== 'false',
  stores: [
    { key: 'albatroz', id: (process.env.STORE_ALBATROZ || '').split('|')[0], name: 'Albatroz' },
    { key: 'point',    id: (process.env.STORE_POINT    || '').split('|')[0], name: 'The Point Offices' },
    { key: 'tagus',    id: (process.env.STORE_TAGUS    || '').split('|')[0], name: 'Tagus II' },
    // { key: 'cd', id: (process.env.STORE_CD || '').split('|')[0], name: 'CD' },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Retorna data em formato YYYY-MM-DD, N dias atrás.
 */
function isoDate(daysAgo = 0) {
  const d = new Date();
  d.setTime(d.getTime() - 3 * 60 * 60 * 1000); // BRT = UTC-3
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

/**
 * Faz uma chamada GET autenticada à API do Onii.
 */
function apiGet(token, path) {
  return new Promise((resolve, reject) => {
    https.get(
      {
        hostname: CONFIG.apiHost,
        path,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
      (res) => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(new Error(`JSON inválido: ${data.slice(0, 200)}`)); }
        });
      }
    ).on('error', reject);
  });
}

// ─── Funções ──────────────────────────────────────────────────────────────────

/**
 * Abre o browser, faz login e captura o Bearer token.
 * @returns {string} token
 */
async function login() {
  console.log('[login] Iniciando browser...');
  const browser = await chromium.launch({ headless: CONFIG.headless });
  const context = await browser.newContext();
  const page    = await context.newPage();

  let token = null;
  page.on('response', async (response) => {
    const auth = response.request().headers()['authorization'];
    if (auth && auth.startsWith('Bearer ')) token = auth.replace('Bearer ', '');
  });

  await page.goto(CONFIG.loginUrl);
  await page.waitForSelector('input[type="email"]', { timeout: 15_000 });
  await page.fill('input[type="email"]',    CONFIG.email);
  await page.fill('input[type="password"]', CONFIG.password);

  const btn = await page.$('button[type="submit"]');
  if (btn) await btn.click();
  else     await page.keyboard.press('Enter');

  await page.waitForLoadState('load').catch(() => {});
  await page.waitForTimeout(3_000);
  await browser.close();

  if (!token) throw new Error('Token não capturado após o login.');
  console.log('[login] Token obtido.');
  return token;
}

/**
 * Busca transações de uma loja em um intervalo de datas via API.
 * @param {string} token
 * @param {object} store   { key, id, name }
 * @param {string} from    YYYY-MM-DD
 * @param {string} to      YYYY-MM-DD
 * @returns {Array<object>} transações brutas enriquecidas com storeKey/storeName
 */
async function fetchStoreTransactions(token, store, from, to) {
  if (!store.id) {
    console.warn(`[fetch] AVISO: id vazio para ${store.name}. Verifique STORE_${store.key.toUpperCase()} no .env`);
    return [];
  }

  console.log(`[fetch] ${store.name} (${from} → ${to})...`);
  const path = `/merchant/transactions?storeId=${store.id}&beginDate=${from}&endDate=${to}`;
  const res  = await apiGet(token, path);

  if (res.result !== 'ok' || !res.payload?.transactions) {
    console.warn(`[fetch] Resposta inesperada para ${store.name}:`, JSON.stringify(res).slice(0, 200));
    return [];
  }

  const txs = res.payload.transactions.filter(t => t.details?.status === 'success');
  console.log(`[fetch] ${txs.length} transações com sucesso em ${store.name}.`);

  return txs.map(t => ({ ...t, storeKey: store.key, storeName: store.name }));
}

/**
 * Orquestra o fluxo completo: login + coleta de todas as lojas.
 * @param {{ dateFrom: string, dateTo: string }} options  datas em YYYY-MM-DD
 * @returns {Array<object>} dados brutos de todas as lojas
 */
async function fetchAll({ dateFrom, dateTo } = {}) {
  const from = dateFrom || isoDate(30);
  const to   = dateTo   || isoDate(0);

  const token = await login();
  let rawData = [];

  for (const store of CONFIG.stores) {
    const rows = await fetchStoreTransactions(token, store, from, to);
    rawData = rawData.concat(rows);
  }

  return rawData;
}

// ─── Entry point ─────────────────────────────────────────────────────────────

if (require.main === module) {
  fetchAll()
    .then(data => {
      const fs   = require('fs');
      const path = require('path');
      const tmp  = path.resolve(__dirname, '../data/_raw.json');
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
      console.log(`[done] ${data.length} registros salvos em ${tmp}`);
    })
    .catch(err => {
      console.error('[fatal]', err.message);
      process.exit(1);
    });
}

module.exports = { fetchAll, login, fetchStoreTransactions };
