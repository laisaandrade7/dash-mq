'use strict';

/**
 * transform-sales.js
 * ─────────────────────────────────────────────
 * Responsável por:
 *   1. Ler os dados brutos coletados pelo fetch-onii.js
 *   2. Normalizar e limpar os valores (datas, moeda, inteiros)
 *   3. Calcular métricas derivadas (ticket médio, totais)
 *   4. Gerar os dois formatos de saída:
 *      - sales.json   → vendas do dia atual por loja
 *      - history.json → histórico diário (N dias) por loja
 * ─────────────────────────────────────────────
 */

require('dotenv').config();
const fs   = require('fs');
const path = require('path');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Converte string de moeda brasileira para número.
 * Aceita: "R$ 1.234,56" | "1.234,56" | "1234.56"
 */
function parseBRL(str = '') {
  const clean = str.replace(/[^\d,.-]/g, '').replace('.', '').replace(',', '.');
  const value = parseFloat(clean);
  return isNaN(value) ? 0 : Math.round(value * 100) / 100;
}

/**
 * Converte string de data para ISO (aaaa-mm-dd).
 * Aceita: "dd/mm/aaaa", "dd/mm/aa, HH:MM:SS" (Onii), "aaaa-mm-dd"
 */
function parseDate(str = '') {
  if (!str) return null;
  // Formato Onii: "27/03/26, 08:44:27" (dia/mês/ano2d, hora)
  const oniiMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{2}),/);
  if (oniiMatch) {
    const year = parseInt(oniiMatch[3], 10) + 2000;
    return `${year}-${oniiMatch[2]}-${oniiMatch[1]}`;
  }
  // Formato dd/mm/aaaa (4 dígitos)
  const longMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (longMatch) return `${longMatch[3]}-${longMatch[2]}-${longMatch[1]}`;
  // Já está em ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  return str;
}

/**
 * Label de exibição da data (dd/mm).
 */
function dateLabel(isoDate = '') {
  if (!isoDate) return '';
  const [, m, d] = isoDate.split('-');
  return `${d}/${m}`;
}

/**
 * Retorna a data de hoje em ISO no fuso BRT (UTC-3),
 * que é o mesmo usado pelo Onii para exibir e filtrar transações.
 */
function todayISO() {
  const d = new Date();
  d.setTime(d.getTime() - 3 * 60 * 60 * 1000);
  return d.toISOString().split('T')[0];
}

// ─── Transformações ──────────────────────────────────────────────────────────

/**
 * Normaliza uma transação bruta retornada pela API do Onii.
 * Campos: cart.totalValue (centavos), createdAt (ISO), storeKey, storeName
 * @param {object} raw
 * @returns {object} linha normalizada
 */
function normalizeRow(raw) {
  const fat = Math.round(raw.cart?.totalValue || 0) / 100;
  // Converte createdAt (UTC) para BRT (UTC-3) antes de extrair a data,
  // garantindo que a data bata com o que o Onii exibe.
  let iso = '';
  if (raw.createdAt) {
    const d = new Date(raw.createdAt);
    d.setTime(d.getTime() - 3 * 60 * 60 * 1000);
    iso = d.toISOString().split('T')[0];
  }

  return {
    date:  iso,
    label: dateLabel(iso),
    store: raw.storeKey || raw.store?._id  || 'unknown',
    name:  raw.storeName || raw.store?.storeInfo?.name || 'Desconhecida',
    fat,
    vnd:   1,
    tkt:   fat,
  };
}

/**
 * Gera o objeto sales.json — resumo do dia atual por loja.
 * @param {Array<object>} rows  linhas normalizadas
 * @returns {object}
 */
function buildSalesJSON(rows) {
  const today = todayISO();
  const todayRows = rows.filter(r => r.date === today);

  // Totais consolidados
  const totalFat = todayRows.reduce((s, r) => s + r.fat, 0);
  const totalVnd = todayRows.reduce((s, r) => s + r.vnd, 0);
  const totalTkt = totalVnd > 0 ? Math.round((totalFat / totalVnd) * 100) / 100 : 0;

  // Por loja
  const stores = {};
  for (const row of todayRows) {
    if (!stores[row.store]) {
      stores[row.store] = { key: row.store, name: row.name, fat: 0, vnd: 0, tkt: 0 };
    }
    stores[row.store].fat += row.fat;
    stores[row.store].vnd += row.vnd;
  }
  for (const s of Object.values(stores)) {
    s.fat = Math.round(s.fat * 100) / 100;
    s.tkt = s.vnd > 0 ? Math.round((s.fat / s.vnd) * 100) / 100 : 0;
  }

  // Ranking
  const ranking = Object.values(stores).sort((a, b) => b.fat - a.fat);

  return {
    date: today,
    label: dateLabel(today),
    summary: {
      fat: Math.round(totalFat * 100) / 100,
      vnd: totalVnd,
      tkt: totalTkt,
    },
    stores: ranking,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Gera o objeto history.json — histórico diário por loja.
 * @param {Array<object>} rows  linhas normalizadas
 * @returns {object}
 */
function buildHistoryJSON(rows) {
  // Agrupa por data + loja
  const byDay = {};

  for (const row of rows) {
    const key = `${row.date}__${row.store}`;
    if (!byDay[key]) {
      byDay[key] = { date: row.date, label: row.label, store: row.store, name: row.name, fat: 0, vnd: 0, tkt: 0 };
    }
    byDay[key].fat += row.fat;
    byDay[key].vnd += row.vnd;
  }

  const records = Object.values(byDay).map(r => ({
    ...r,
    fat: Math.round(r.fat * 100) / 100,
    tkt: r.vnd > 0 ? Math.round((r.fat / r.vnd) * 100) / 100 : 0,
  }));

  // Ordena por data asc, loja asc
  records.sort((a, b) => a.date.localeCompare(b.date) || a.store.localeCompare(b.store));

  // Datas únicas disponíveis
  const dates = [...new Set(records.map(r => r.date))];

  return {
    records,
    dates,
    stores: [...new Set(records.map(r => r.store))],
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Extrai os itens do carrinho de uma transação bruta.
 * Tenta múltiplos formatos de campo — o Onii usa chaves abreviadas (n, b, q, p).
 */
function extractCartItems(raw) {
  const items = raw.cart?.items || raw.cart?.products || [];
  if (!Array.isArray(items) || items.length === 0) return [];

  return items.map(item => {
    const name  = item.n || item.name || item.productName || item.description || '';
    const ean   = String(item.b || item.ean || item.barcode || item.productId || '');
    const qty   = item.q || item.qty || item.quantity || item.amount || 1;
    const price = Math.round(item.p || item.unitPrice || item.price || 0) / 100;
    const total = Math.round(item.tp || item.totalPrice || item.total || (item.p ? item.p * qty : 0)) / 100;
    return { name, ean, qty, price, total: total || Math.round(price * qty * 100) / 100 };
  }).filter(i => i.name);
}

/**
 * Agrega vendas por produto a partir das transações brutas.
 * @param {Array<object>} rawData  dados brutos
 * @returns {object}
 */
function buildProductsJSON(rawData) {
  const byProduct = {};

  for (const raw of rawData) {
    const items     = extractCartItems(raw);
    const storeKey  = raw.storeKey || 'unknown';
    const storeName = raw.storeName || storeKey;

    // Converte createdAt para BRT antes de extrair data (mesma lógica do normalizeRow)
    let date = '';
    if (raw.createdAt) {
      const d = new Date(raw.createdAt);
      d.setTime(d.getTime() - 3 * 60 * 60 * 1000);
      date = d.toISOString().split('T')[0];
    }

    for (const item of items) {
      if (!item.name) continue;
      const key = item.name.toLowerCase().trim();

      if (!byProduct[key]) {
        byProduct[key] = {
          name:    item.name,
          ean:     item.ean,
          revenue: 0,
          qty:     0,
          byStore: {},
        };
      }

      const prod = byProduct[key];
      prod.revenue += item.total;
      prod.qty     += item.qty;

      if (!prod.byStore[storeKey]) {
        prod.byStore[storeKey] = { name: storeName, revenue: 0, qty: 0 };
      }
      prod.byStore[storeKey].revenue += item.total;
      prod.byStore[storeKey].qty     += item.qty;
    }
  }

  const items = Object.values(byProduct)
    .map(p => ({
      ...p,
      revenue: Math.round(p.revenue * 100) / 100,
      avgPrice: p.qty > 0 ? Math.round((p.revenue / p.qty) * 100) / 100 : 0,
      byStore: Object.fromEntries(
        Object.entries(p.byStore).map(([k, v]) => [k, {
          ...v,
          revenue: Math.round(v.revenue * 100) / 100,
        }])
      ),
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const hasData = items.length > 0;
  console.log(`[transform] products.json → ${items.length} produtos${hasData ? '' : ' (sem itens de carrinho nos dados brutos)'}`);

  return {
    generatedAt: new Date().toISOString(),
    items,
    hasCartData: hasData,
  };
}

/**
 * Gera transactions.json — cada transação com seus itens de carrinho.
 * @param {Array<object>} rawData  dados brutos
 * @returns {object}
 */
function buildTransactionsJSON(rawData) {
  const transactions = [];

  for (const raw of rawData) {
    const items = extractCartItems(raw);
    if (items.length === 0) continue;

    const storeKey  = raw.storeKey  || 'unknown';
    const storeName = raw.storeName || storeKey;
    const cartTotal = Math.round(raw.cart?.totalValue || 0) / 100;

    let date = '';
    let time = '';
    if (raw.createdAt) {
      const d = new Date(raw.createdAt);
      d.setTime(d.getTime() - 3 * 60 * 60 * 1000);
      date = d.toISOString().split('T')[0];
      time = d.toISOString().split('T')[1].slice(0, 5);
    }

    transactions.push({ date, time, store: storeKey, storeName, total: cartTotal, items });
  }

  transactions.sort((a, b) =>
    b.date.localeCompare(a.date) || b.time.localeCompare(a.time)
  );

  const hasData = transactions.length > 0;
  console.log(`[transform] transactions.json → ${transactions.length} transações com itens`);

  return { generatedAt: new Date().toISOString(), hasCartData: hasData, transactions };
}

/**
 * Orquestra a transformação completa.
 * @param {Array<object>} rawData  dados brutos (opcional — lê de _raw.json se omitido)
 * @returns {{ sales: object, history: object, products: object, transactions: object }}
 */
function transform(rawData) {
  const dataDir = path.resolve(__dirname, '..', process.env.DATA_OUTPUT_DIR || 'data');
  const rawPath = path.join(dataDir, '_raw.json');

  let raw = rawData;
  if (!raw) {
    if (!fs.existsSync(rawPath)) {
      throw new Error(`Arquivo de dados brutos não encontrado: ${rawPath}`);
    }
    raw = JSON.parse(fs.readFileSync(rawPath, 'utf-8'));
  }

  console.log(`[transform] Processando ${raw.length} registros brutos...`);

  const normalized    = raw.map(normalizeRow).filter(r => r.date);
  const sales         = buildSalesJSON(normalized);
  const history       = buildHistoryJSON(normalized);
  const products      = buildProductsJSON(raw);
  const transactions  = buildTransactionsJSON(raw);

  console.log(`[transform] sales.json  → ${sales.stores.length} lojas, data: ${sales.date}`);
  console.log(`[transform] history.json → ${history.records.length} registros, ${history.dates.length} dias`);

  return { sales, history, products, transactions };
}

// ─── Entry point ─────────────────────────────────────────────────────────────

if (require.main === module) {
  try {
    const result = transform();
    const saveJSON = require('./save-json');
    saveJSON.save('sales',        result.sales);
    saveJSON.save('history',      result.history);
    saveJSON.save('products',     result.products);
    saveJSON.save('transactions', result.transactions);
    console.log('[done] Transformação concluída.');
  } catch (err) {
    console.error('[fatal]', err.message);
    process.exit(1);
  }
}

module.exports = { transform, normalizeRow, buildSalesJSON, buildHistoryJSON, buildProductsJSON, buildTransactionsJSON, parseBRL, parseDate };
