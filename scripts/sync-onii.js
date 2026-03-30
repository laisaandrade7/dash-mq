'use strict';

/**
 * sync-onii.js
 * ─────────────────────────────────────────────
 * Orquestrador único do pipeline de dados:
 *   1. Login → token
 *   2. Fetch → dados brutos de todas as lojas
 *   3. Transform → sales.json + history.json
 *   4. Save → persiste em /data com backup
 *   5. Upload → envia ao servidor via FTP (opcional)
 *
 * Uso:
 *   node scripts/sync-onii.js           → completo
 *   node scripts/sync-onii.js --no-ftp  → sem upload
 *   node scripts/sync-onii.js --days 7  → últimos N dias
 * ─────────────────────────────────────────────
 */

require('dotenv').config();
const https   = require('https');
const path    = require('path');
const fs      = require('fs');
const { login }     = require('./login-onii');
const { transform } = require('./transform-sales');
const { save, cleanRaw } = require('./save-json');

// ─── Configuração ─────────────────────────────────────────────────────────────

const CONFIG = {
  apiHost: 'platform.onii.com.br',
  stores: [
    { key: 'albatroz', id: (process.env.STORE_ALBATROZ || '').split('|')[0], name: 'Albatroz' },
    { key: 'point',    id: (process.env.STORE_POINT    || '').split('|')[0], name: 'The Point Offices' },
    { key: 'tagus',    id: (process.env.STORE_TAGUS    || '').split('|')[0], name: 'Tagus II' },
  ],
  dataDir: path.resolve(__dirname, '..', process.env.DATA_OUTPUT_DIR || 'data'),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoDate(daysAgo = 0) {
  const d = new Date();
  d.setTime(d.getTime() - 3 * 60 * 60 * 1000); // BRT = UTC-3
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    noFtp: args.includes('--no-ftp'),
    days:  parseInt(args[args.indexOf('--days') + 1]) || 30,
  };
}

function apiGet(token, path) {
  return new Promise((resolve, reject) => {
    https.get(
      {
        hostname: CONFIG.apiHost,
        path,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type':  'application/json',
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

// ─── Etapas do pipeline ───────────────────────────────────────────────────────

async function fetchStore(token, store, from, to) {
  if (!store.id) {
    console.warn(`[fetch] AVISO: id não configurado para ${store.name}`);
    return [];
  }

  const endpoint = `/merchant/transactions?storeId=${store.id}&beginDate=${from}&endDate=${to}`;
  const res = await apiGet(token, endpoint);

  if (res.result !== 'ok' || !res.payload?.transactions) {
    console.warn(`[fetch] Resposta inesperada para ${store.name}:`, JSON.stringify(res).slice(0, 200));
    return [];
  }

  const txs = res.payload.transactions.filter(t => t.details?.status === 'success');
  console.log(`[fetch] ${store.name}: ${txs.length} transações aprovadas (${from} → ${to})`);

  return txs.map(t => ({ ...t, storeKey: store.key, storeName: store.name }));
}

async function fetchAll(token, from, to) {
  let raw = [];
  for (const store of CONFIG.stores) {
    const rows = await fetchStore(token, store, from, to);
    raw = raw.concat(rows);
  }
  return raw;
}

function saveRaw(raw) {
  const rawPath = path.join(CONFIG.dataDir, '_raw.json');
  fs.mkdirSync(CONFIG.dataDir, { recursive: true });
  fs.writeFileSync(rawPath, JSON.stringify(raw, null, 2), 'utf-8');
  console.log(`[save] _raw.json: ${raw.length} registros`);
}

// ─── Entry point ─────────────────────────────────────────────────────────────

async function run() {
  const { noFtp, days } = parseArgs();
  const from = isoDate(days);
  const to   = isoDate(0);

  console.log(`\n╔══ Sync Onii ══════════════════════════════`);
  console.log(`║  Período : ${from} → ${to}`);
  console.log(`║  FTP     : ${noFtp ? 'desativado' : 'ativado'}`);
  console.log(`╚═══════════════════════════════════════════\n`);

  // 1. Login
  const token = await login();

  // 2. Fetch
  console.log('\n[sync] Buscando transações...');
  const raw = await fetchAll(token, from, to);
  saveRaw(raw);

  // 3. Transform + Save
  console.log('\n[sync] Transformando dados...');
  const { sales, history } = transform(raw);
  save('sales',   sales);
  save('history', history);
  cleanRaw();

  // 4. Upload FTP (opcional)
  if (!noFtp && process.env.FTP_HOST) {
    console.log('\n[sync] Enviando para FTP...');
    const { upload } = require('./upload-ftp');
    await upload();
  } else if (!noFtp && !process.env.FTP_HOST) {
    console.log('[sync] FTP_HOST não configurado — pulando upload.');
  }

  console.log('\n✓ Sync concluído.\n');
}

run().catch(err => {
  console.error('\n[fatal]', err.message);
  process.exit(1);
});
