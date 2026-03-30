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
 * Orquestra a transformação completa.
 * @param {Array<object>} rawData  dados brutos (opcional — lê de _raw.json se omitido)
 * @returns {{ sales: object, history: object }}
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

  const normalized = raw.map(normalizeRow).filter(r => r.date);
  const sales      = buildSalesJSON(normalized);
  const history    = buildHistoryJSON(normalized);

  console.log(`[transform] sales.json  → ${sales.stores.length} lojas, data: ${sales.date}`);
  console.log(`[transform] history.json → ${history.records.length} registros, ${history.dates.length} dias`);

  return { sales, history };
}

// ─── Entry point ─────────────────────────────────────────────────────────────

if (require.main === module) {
  try {
    const result = transform();
    // Persiste nos arquivos finais
    const saveJSON = require('./save-json');
    saveJSON.save('sales',   result.sales);
    saveJSON.save('history', result.history);
    console.log('[done] Transformação concluída.');
  } catch (err) {
    console.error('[fatal]', err.message);
    process.exit(1);
  }
}

module.exports = { transform, normalizeRow, buildSalesJSON, buildHistoryJSON, parseBRL, parseDate };
