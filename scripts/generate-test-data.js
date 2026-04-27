'use strict';

/**
 * generate-test-data.js
 * Gera dados de teste realistas para o dashboard em localhost.
 * Uso: node scripts/generate-test-data.js
 */

const fs   = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '..', 'data');

// ─── Catálogo de produtos ─────────────────────────────────────────────────────

const PRODUCTS = [
  { name: 'Coca-Cola Lata 350ml',         ean: '7894900010015', price: 1.50 },
  { name: 'Coca-Cola Zero Lata 350ml',     ean: '7894900011098', price: 1.50 },
  { name: 'Guaraná Antarctica Lata 350ml', ean: '7891991010856', price: 1.50 },
  { name: 'Sprite Lata 350ml',             ean: '7894900011029', price: 1.50 },
  { name: 'Fanta Laranja Lata 350ml',      ean: '7894900040036', price: 1.50 },
  { name: 'Schweppes Tônica 350ml',        ean: '7894900330014', price: 1.50 },
  { name: 'Skol Lata 350ml',              ean: '7891149103504', price: 1.50 },
  { name: 'Brahma Lata 350ml',            ean: '7891149401018', price: 1.50 },
  { name: 'Stella Artois Lata 350ml',     ean: '7891149109803', price: 2.00 },
  { name: 'Red Bull Energy 250ml',        ean: '9002490100070', price: 4.00 },
  { name: 'Monster Energy 473ml',         ean: '0070847811961', price: 5.00 },
  { name: 'Gatorade Limão 500ml',         ean: '7892840815506', price: 3.00 },
  { name: 'Puri Água Coco 300ml',         ean: '7899999100023', price: 2.00 },
  { name: 'Ruffles Original 45g',         ean: '7892840222506', price: 2.00 },
  { name: 'Doritos Nacho 45g',            ean: '7892840222476', price: 2.00 },
  { name: 'Cheetos Requeijão 45g',        ean: '7892840222452', price: 2.00 },
  { name: 'LivUp Mix Nuts 40g',           ean: '7898902310045', price: 3.00 },
  { name: 'LivUp Castanha de Caju 40g',   ean: '7898902310012', price: 3.00 },
  { name: 'LivUp Barra Proteína 45g',     ean: '7898902310067', price: 3.00 },
  { name: 'Amendoim Crocante',            ean: '1234560000001', price: 1.00 },
  { name: 'Kit Kat 42g',                  ean: '7898024396079', price: 2.50 },
  { name: 'Bis Chocolate 100g',           ean: '7622210951793', price: 3.50 },
  { name: 'Toddynho 200ml',              ean: '7896004009006', price: 1.50 },
  { name: 'Nescau Prontinho 200ml',      ean: '7613039868492', price: 1.50 },
  { name: 'Del Valle Uva 290ml',         ean: '7894900702200', price: 1.50 },
];

const STORES = [
  { key: 'albatroz', name: 'Albatroz' },
  { key: 'point',    name: 'The Point Offices' },
  { key: 'tagus',    name: 'Tagus II' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rnd(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function isoDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

function randomTime(startH = 7, endH = 22) {
  const h = rnd(startH, endH - 1);
  const m = rnd(0, 59);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ─── Geração ──────────────────────────────────────────────────────────────────

function generateTransactions() {
  const transactions = [];

  for (let day = 0; day < 30; day++) {
    const date = isoDate(day);

    for (const store of STORES) {
      // Menos transações nos fins de semana
      const dow = new Date(date).getDay();
      const isWeekend = dow === 0 || dow === 6;
      const txCount = isWeekend ? rnd(2, 5) : rnd(4, 10);

      for (let t = 0; t < txCount; t++) {
        const itemCount = rnd(1, 4);
        const usedProducts = new Set();
        const items = [];

        for (let i = 0; i < itemCount; i++) {
          let product;
          let attempts = 0;
          do {
            product = pick(PRODUCTS);
            attempts++;
          } while (usedProducts.has(product.ean) && attempts < 10);

          usedProducts.add(product.ean);
          const qty   = rnd(1, 3);
          const total = Math.round(product.price * qty * 100) / 100;
          items.push({ name: product.name, ean: product.ean, qty, price: product.price, total });
        }

        const cartTotal = items.reduce((s, i) => s + i.total, 0);

        transactions.push({
          date,
          time: randomTime(),
          store: store.key,
          storeName: store.name,
          total: Math.round(cartTotal * 100) / 100,
          items,
        });
      }
    }
  }

  // Ordena: data desc, hora desc
  transactions.sort((a, b) =>
    b.date.localeCompare(a.date) || b.time.localeCompare(a.time)
  );

  return {
    generatedAt: new Date().toISOString(),
    hasCartData: true,
    transactions,
  };
}

// ─── Stock de teste ───────────────────────────────────────────────────────────

function generateStock() {
  const lowItems = [
    { name: 'Red Bull Energy 250ml',    ean: '9002490100070', supplier: 'Beverages BR',  store: 'albatroz', cq: 0, iq: 12 },
    { name: 'Coca-Cola Lata 350ml',     ean: '7894900010015', supplier: 'Coca-Cola',     store: 'point',    cq: 1, iq: 24 },
    { name: 'LivUp Mix Nuts 40g',       ean: '7898902310045', supplier: 'LivUp',         store: 'tagus',    cq: 2, iq: 10 },
    { name: 'Monster Energy 473ml',     ean: '0070847811961', supplier: 'Beverages BR',  store: 'albatroz', cq: 0, iq: 8  },
    { name: 'Ruffles Original 45g',     ean: '7892840222506', supplier: 'PepsiCo',       store: 'point',    cq: 1, iq: 15 },
    { name: 'Stella Artois Lata 350ml', ean: '7891149109803', supplier: 'Ambev',         store: 'tagus',    cq: 3, iq: 12 },
    { name: 'LivUp Barra Proteína 45g', ean: '7898902310067', supplier: 'LivUp',         store: 'albatroz', cq: 2, iq: 8  },
    { name: 'Kit Kat 42g',              ean: '7898024396079', supplier: 'Nestlé',        store: 'point',    cq: 0, iq: 10 },
    { name: 'Del Valle Uva 290ml',      ean: '7894900702200', supplier: 'Coca-Cola',     store: 'tagus',    cq: 1, iq: 12 },
    { name: 'Toddynho 200ml',           ean: '7896004009006', supplier: 'PepsiCo',       store: 'albatroz', cq: 3, iq: 10 },
  ];

  return {
    generatedAt: new Date().toISOString(),
    totalLow: lowItems.length,
    totalProducts: PRODUCTS.length,
    low: lowItems,
    byStore: {
      albatroz: { low: lowItems.filter(i => i.store === 'albatroz').length, total: PRODUCTS.length },
      point:    { low: lowItems.filter(i => i.store === 'point').length,    total: PRODUCTS.length },
      tagus:    { low: lowItems.filter(i => i.store === 'tagus').length,    total: PRODUCTS.length },
    },
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const txData    = generateTransactions();
const stockData = generateStock();

fs.writeFileSync(path.join(DATA_DIR, 'transactions.json'), JSON.stringify(txData, null, 2));
fs.writeFileSync(path.join(DATA_DIR, 'stock.json'), JSON.stringify(stockData, null, 2));

const totalTx    = txData.transactions.length;
const totalItems = txData.transactions.reduce((s, t) => s + t.items.length, 0);
console.log(`[test-data] transactions.json → ${totalTx} transações, ${totalItems} itens`);
console.log(`[test-data] stock.json        → ${stockData.totalLow} alertas`);
console.log('[test-data] Pronto. Rode: npm run serve');
