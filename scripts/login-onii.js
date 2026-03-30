'use strict';

/**
 * login-onii.js
 * ─────────────────────────────────────────────
 * Responsável exclusivamente por:
 *   1. Abrir o Chromium via Playwright
 *   2. Fazer login no Onii (merchant.onii.app)
 *   3. Capturar o Bearer token dos headers
 *   4. Fechar o browser e retornar o token
 * ─────────────────────────────────────────────
 */

require('dotenv').config();
const { chromium } = require('playwright');

const CONFIG = {
  loginUrl: 'https://merchant.onii.app',
  email:    process.env.ONII_EMAIL    || '',
  password: process.env.ONII_PASSWORD || '',
  headless: process.env.HEADLESS !== 'false',
  timeout:  20_000,
};

/**
 * Faz login no Onii e retorna o Bearer token.
 * @returns {Promise<string>} token
 */
async function login() {
  if (!CONFIG.email || !CONFIG.password) {
    throw new Error('ONII_EMAIL e ONII_PASSWORD são obrigatórios no .env');
  }

  console.log('[login] Abrindo browser...');
  const browser = await chromium.launch({ headless: CONFIG.headless });
  const context = await browser.newContext();
  const page    = await context.newPage();

  let token = null;

  page.on('response', async (response) => {
    const auth = response.request().headers()['authorization'];
    if (auth && auth.startsWith('Bearer ') && !token) {
      token = auth.replace('Bearer ', '');
    }
  });

  await page.goto(CONFIG.loginUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: CONFIG.timeout });

  await page.fill('input[type="email"]',    CONFIG.email);
  await page.fill('input[type="password"]', CONFIG.password);

  const btn = await page.$('button[type="submit"]');
  if (btn) await btn.click();
  else     await page.keyboard.press('Enter');

  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(3_000);
  await browser.close();

  if (!token) throw new Error('Token não capturado. Verifique credenciais ou seletores de login.');

  console.log('[login] Token obtido com sucesso.');
  return token;
}

module.exports = { login };
