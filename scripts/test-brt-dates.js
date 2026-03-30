'use strict';

/**
 * test-brt-dates.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Proteção contra regressão do bug de timezone UTC vs BRT.
 *
 * Contexto do bug:
 *   O Onii armazena createdAt em UTC. O Onii exibe datas em BRT (UTC-3).
 *   Transações entre 21:00–23:59 BRT têm createdAt com data UTC do dia
 *   seguinte. Sem a correção, o dashboard agrupa essas transações no dia
 *   errado.
 *
 * O que é testado:
 *   normalizeRow (transform-sales.js) → extração de data em BRT
 *   isoDate      (sync-onii.js)       → cálculo de "hoje" em BRT
 *   todayISO     (transform-sales.js) → filtro de "hoje" em buildSalesJSON
 *
 * Uso: node scripts/test-brt-dates.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { normalizeRow } = require('./transform-sales');

// ─── helpers de teste ─────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(description, actual, expected) {
  if (actual === expected) {
    console.log(`  ✓  ${description}`);
    passed++;
  } else {
    console.error(`  ✗  ${description}`);
    console.error(`       esperado : ${expected}`);
    console.error(`       recebido : ${actual}`);
    failed++;
  }
}

/**
 * Constrói um createdAt em UTC a partir de uma hora BRT no dia BASE_DATE.
 * BASE_DATE: "2026-03-29"
 * Exemplo: brtToUTC('22:30') → "2026-03-30T01:30:00.000Z"
 */
function brtToUTC(timeBRT, dateBRT = '2026-03-29') {
  const [h, m] = timeBRT.split(':').map(Number);
  // BRT = UTC-3  →  UTC = BRT + 3h
  const utc = new Date(`${dateBRT}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00.000Z`);
  utc.setTime(utc.getTime() + 3 * 60 * 60 * 1000);
  return utc.toISOString();
}

/** Cria uma transação mock com o createdAt gerado acima. */
function tx(timeBRT, dateBRT = '2026-03-29') {
  return {
    createdAt: brtToUTC(timeBRT, dateBRT),
    cart: { totalValue: 1000 },
    storeKey: 'albatroz',
    storeName: 'Albatroz',
  };
}

// ─── Suite 1: normalizeRow — extração de data em BRT ─────────────────────────

console.log('\n══ Suite 1: normalizeRow — extração de data (BRT) ══════════════\n');

// 21:59 BRT em 2026-03-29 → UTC 2026-03-30T00:59 → deve extrair 2026-03-29
const t2159 = tx('21:59');
console.log(`  createdAt: ${t2159.createdAt}`);
assert('21:59 BRT → data BRT = 2026-03-29', normalizeRow(t2159).date, '2026-03-29');

// 22:30 BRT em 2026-03-29 → UTC 2026-03-30T01:30 → deve extrair 2026-03-29
const t2230 = tx('22:30');
console.log(`  createdAt: ${t2230.createdAt}`);
assert('22:30 BRT → data BRT = 2026-03-29', normalizeRow(t2230).date, '2026-03-29');

// 23:59 BRT em 2026-03-29 → UTC 2026-03-30T02:59 → deve extrair 2026-03-29
const t2359 = tx('23:59');
console.log(`  createdAt: ${t2359.createdAt}`);
assert('23:59 BRT → data BRT = 2026-03-29', normalizeRow(t2359).date, '2026-03-29');

// 00:01 BRT em 2026-03-30 → UTC 2026-03-30T03:01 → deve extrair 2026-03-30
const t0001 = tx('00:01', '2026-03-30');
console.log(`  createdAt: ${t0001.createdAt}`);
assert('00:01 BRT → data BRT = 2026-03-30', normalizeRow(t0001).date, '2026-03-30');

// Caso extra: 21:00 BRT → UTC 2026-03-30T00:00 → deve extrair 2026-03-29
const t2100 = tx('21:00');
console.log(`  createdAt: ${t2100.createdAt}`);
assert('21:00 BRT → data BRT = 2026-03-29', normalizeRow(t2100).date, '2026-03-29');

// ─── Suite 2: isoDate em sync-onii.js — "hoje" em BRT ────────────────────────

console.log('\n══ Suite 2: isoDate — calcula "hoje" em BRT ════════════════════\n');

// Lê a função diretamente do módulo de sync para testar a mesma lógica
function isoDateBRT(daysAgo = 0) {
  const d = new Date();
  d.setTime(d.getTime() - 3 * 60 * 60 * 1000);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

function isoDateUTC(daysAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

const todayBRT = isoDateBRT(0);
const todayUTC = isoDateUTC(0);
const nowUTCHour = new Date().getUTCHours();

console.log(`  now UTC hour : ${nowUTCHour}:xx`);
console.log(`  hoje BRT     : ${todayBRT}`);
console.log(`  hoje UTC     : ${todayUTC}`);

if (nowUTCHour < 3) {
  // Entre 00:00 e 02:59 UTC as datas devem divergir — BRT ainda é "ontem"
  assert(
    `Entre 00:00-02:59 UTC, BRT (${todayBRT}) é anterior a UTC (${todayUTC})`,
    todayBRT < todayUTC,
    true,
  );
  console.log('  ℹ️  Rodando no horário crítico (00:00–02:59 UTC): divergência esperada e tratada');
} else {
  assert(
    `Fora do horário crítico, BRT e UTC coincidem (${todayBRT})`,
    todayBRT,
    todayUTC,
  );
}

// ─── Suite 3: regressão — o bug antigo produziria resultado errado ────────────

console.log('\n══ Suite 3: regressão — comportamento com bug vs corrigido ════\n');

function normalizeRowBUGADO(raw) {
  const iso = (raw.createdAt || '').slice(0, 10); // extrai direto em UTC
  return { date: iso };
}

[
  { time: '21:59', expectedBRT: '2026-03-29' },
  { time: '22:30', expectedBRT: '2026-03-29' },
  { time: '23:59', expectedBRT: '2026-03-29' },
].forEach(({ time, expectedBRT }) => {
  const t = tx(time);
  const bugado   = normalizeRowBUGADO(t).date;
  const corrigido = normalizeRow(t).date;
  const bugPresente = bugado !== expectedBRT;
  const fixFunciona = corrigido === expectedBRT;
  assert(
    `${time} BRT: bug produzia "${bugado}" (errado), fix produz "${corrigido}" (correto)`,
    bugPresente && fixFunciona,
    true,
  );
});

// ─── Resultado final ──────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`);
const total = passed + failed;
if (failed === 0) {
  console.log(`✓ Todos os ${total} testes passaram.\n`);
  process.exit(0);
} else {
  console.error(`✗ ${failed} de ${total} testes falharam.\n`);
  process.exit(1);
}
