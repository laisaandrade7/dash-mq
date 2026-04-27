'use strict';

/**
 * fetch-stock.js
 * ─────────────────────────────────────────────
 * Busca o estoque atual de todas as lojas via API do Onii e gera stock.json.
 *
 * Endpoint: GET https://platform.onii.com.br/merchant/products?storeId={id}
 * Campos relevantes:
 *   n  — nome do produto
 *   b  — EAN / código de barras
 *   cq — quantidade atual
 *   iq — quantidade ideal (planograma)
 *
 * Alerta: produto com cq < iq (e iq > 0)
 * ─────────────────────────────────────────────
 */

require('dotenv').config();
const https = require('https');
const path  = require('path');
const fs    = require('fs');

const STORES = [
  { key: 'albatroz', id: (process.env.STORE_ALBATROZ || '').split('|')[0], name: 'Albatroz' },
  { key: 'point',    id: (process.env.STORE_POINT    || '').split('|')[0], name: 'The Point Offices' },
  { key: 'tagus',    id: (process.env.STORE_TAGUS    || '').split('|')[0], name: 'Tagus II' },
];

const SUPPLIERS = {
  'Eskimó':        ['eskimó', 'eskimo', 'skimó', 'skimo'],
  'LivUp':         ['liv up', 'livup'],
  'Puri':          ['puri'],
  'Coca-Cola':     ['coca-cola', 'coca cola', 'sprite', 'fanta', 'schweppes', 'del valle',
                    'powerade', 'ades', 'monster', 'kuat', 'matte leão', 'matte leao',
                    'leão', 'leao', 'therezópolis', 'therezopolis'],
  'Bees (Ambev)':  ['budweiser', 'brahma', 'skol', 'spaten', 'corona', 'bohemia', 'stella',
                    'michelob', 'guaraná antarctica', 'guarana antarctica',
                    'guaraná antártica', 'guarana antartica', 'red bull', 'guaravita'],
  'Bees (Pepsico)':['pepsi', 'h2oh', 'h2o limon', 'gatorade', 'doritos', 'ruffles',
                    'lays', 'cheetos', 'quaker', 'toddy', 'toddyinho', 'layout sensações'],
};

function classifySupplier(name = '') {
  const lower = name.toLowerCase();
  for (const [supplier, keywords] of Object.entries(SUPPLIERS)) {
    if (keywords.some(kw => new RegExp(`\\b${kw}\\b`).test(lower))) return supplier;
  }
  return 'Outros';
}

function apiGet(token, urlPath) {
  return new Promise((resolve, reject) => {
    https.get(
      {
        hostname: 'platform.onii.com.br',
        path: urlPath,
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

async function fetchStoreProducts(token, store) {
  if (!store.id) {
    console.warn(`[stock] ID vazio para ${store.name}`);
    return [];
  }

  const res      = await apiGet(token, `/merchant/products?storeId=${store.id}`);
  const products = res?.payload?.products || [];

  return products
    .filter(p => p.iq > 0) // ignora produtos inativos no planograma
    .map(p => ({
      store:     store.key,
      storeName: store.name,
      name:      String(p.n || ''),
      ean:       String(p.b || ''),
      cq:        typeof p.cq === 'number' ? p.cq : 0,
      iq:        typeof p.iq === 'number' ? p.iq : 0,
      supplier:  classifySupplier(p.n),
    }));
}

async function fetchStock(token) {
  let allItems = [];

  for (const store of STORES) {
    console.log(`[stock] Buscando produtos: ${store.name}...`);
    const items = await fetchStoreProducts(token, store);
    console.log(`[stock] ${store.name}: ${items.length} produtos ativos`);
    allItems = allItems.concat(items);
  }

  const low = allItems.filter(p => p.cq < p.iq);

  const byStore = {};
  for (const store of STORES) {
    const storeItems = allItems.filter(p => p.store === store.key);
    const storeLow   = storeItems.filter(p => p.cq < p.iq);
    byStore[store.key] = {
      name:  store.name,
      total: storeItems.length,
      low:   storeLow.length,
    };
  }

  return {
    generatedAt: new Date().toISOString(),
    items: allItems,
    low,
    byStore,
    totalProducts: allItems.length,
    totalLow: low.length,
  };
}

async function fetchAndSave(token) {
  const stock   = await fetchStock(token);
  const dataDir = path.resolve(__dirname, '..', process.env.DATA_OUTPUT_DIR || 'data');
  const outPath = path.join(dataDir, 'stock.json');

  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(stock, null, 2), 'utf-8');
  console.log(`[stock] stock.json: ${stock.totalProducts} produtos, ${stock.totalLow} em alerta`);

  return stock;
}

module.exports = { fetchAndSave, fetchStock };
