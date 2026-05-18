// ============================================
// PRODUTOS & ESTOQUE — Minha Quitandinha
// ============================================

function fmtBRL(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtNum(v) {
  return Number(v || 0).toLocaleString('pt-BR');
}

const STORE_NAMES = {
  albatroz: 'Albatroz',
  point:    'The Point',
  tagus:    'Tagus II',
  cd:       'CD',
};

const STORE_COLORS = {
  albatroz: '#4f7cff',
  point:    '#1fd47a',
  tagus:    '#f5c842',
  cd:       '#a78bfa',
};

const STORES_ORDER = ['albatroz', 'point', 'tagus', 'cd'];

// ── Estado global ──────────────────────────────────────────────────────────────

let stockData        = null;
let transactionsData = null;
let currentStore    = 'all';
let currentSupplier = 'all';
let searchQuery     = '';
let selectedProduct = null;
let stockSortCol    = 'cq';
let stockSortDir    = 'asc';
let stockSearchQuery = '';

// ── Fetch de dados ─────────────────────────────────────────────────────────────

async function loadData() {
  const t = Date.now();
  try {
    const [stockRes, txRes] = await Promise.all([
      fetch(`data/stock.json?t=${t}`),
      fetch(`data/transactions.json?t=${t}`),
    ]);

    if (stockRes.ok) stockData        = await stockRes.json();
    if (txRes.ok)    transactionsData = await txRes.json();
  } catch (e) {
    console.warn('[produtos] Erro ao carregar dados:', e.message);
  }

  render();
}

// ── Render principal ───────────────────────────────────────────────────────────

function render() {
  renderSyncLabel();
  renderStockKPIs();
  renderStockTable();
  renderProductsSection();
}

function renderSyncLabel() {
  const el = document.getElementById('last-sync-label');
  if (!el) return;
  const ts = stockData?.generatedAt || transactionsData?.generatedAt;
  if (!ts) { el.textContent = 'Sem dados'; return; }
  const d = new Date(ts);
  el.textContent = `Atualizado ${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

// ── KPIs de estoque ────────────────────────────────────────────────────────────

function renderStockKPIs() {
  if (!stockData) return;

  const byStore = stockData.byStore || {};
  const urgents = (stockData.low || []).filter(i => i.cq <= 3);

  const filteredLow = currentStore === 'all'
    ? urgents.length
    : urgents.filter(i => i.store === currentStore).length;

  const filteredTotal = currentStore === 'all'
    ? stockData.totalProducts
    : (byStore[currentStore]?.total ?? 0);

  setText('kpi-total-low',      filteredLow);
  setText('kpi-total-products', filteredTotal);
  setText('kpi-low-albatroz',   urgents.filter(i => i.store === 'albatroz').length);
  setText('kpi-low-point',      urgents.filter(i => i.store === 'point').length);
  setText('kpi-low-tagus',      urgents.filter(i => i.store === 'tagus').length);
}

// ── Índice de estoque: produto → { name, supplier, stores: {store: cq} } ───────

function buildStoreIndex(stockJson) {
  // Usa stockData.items quando disponível (dados reais); cai em low para dados de teste
  const source = stockJson.items || stockJson.low || [];
  const idx = new Map();
  for (const item of source) {
    const key = item.name.toLowerCase().trim();
    if (!idx.has(key)) idx.set(key, { name: item.name, supplier: item.supplier, stores: {} });
    idx.get(key).stores[item.store] = item.cq;
  }
  return idx;
}

// ── Tabela de estoque (alertas ou busca) ───────────────────────────────────────

function renderStockTable() {
  const tableEl  = document.getElementById('stock-table');
  const empty    = document.getElementById('stock-empty');
  const wrap     = document.getElementById('stock-table-wrap');
  const subtitle = document.getElementById('stock-subtitle');
  if (!tableEl) return;

  if (!stockData) {
    show(wrap, false); show(empty, false);
    return;
  }

  const storeIdx = buildStoreIndex(stockData);

  if (stockSearchQuery.trim()) {
    renderStockTableSearch(tableEl, storeIdx, empty, wrap, subtitle);
  } else {
    renderStockTableAlerts(tableEl, storeIdx, empty, wrap, subtitle);
  }
}

function thCls(col) {
  if (stockSortCol !== col) return 'sortable';
  return `sortable sort-active sort-${stockSortDir}`;
}

// Modo alerta: apenas produtos com cq <= 3, com breakdown de lojas na sub-linha
function renderStockTableAlerts(tableEl, storeIdx, empty, wrap, subtitle) {
  let items = (stockData.low || []).filter(i => i.cq <= 3);
  if (currentStore !== 'all')    items = items.filter(i => i.store === currentStore);
  if (currentSupplier !== 'all') items = items.filter(i => i.supplier === currentSupplier);

  items = items.slice().sort((a, b) => {
    let va, vb;
    if (stockSortCol === 'name')          { va = a.name;                          vb = b.name; }
    else if (stockSortCol === 'supplier') { va = a.supplier;                      vb = b.supplier; }
    else if (stockSortCol === 'store')    { va = STORE_NAMES[a.store] || a.store; vb = STORE_NAMES[b.store] || b.store; }
    else                                  { va = a.cq;                            vb = b.cq; }
    const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
    return stockSortDir === 'asc' ? cmp : -cmp;
  });

  if (items.length === 0) {
    show(wrap, false); show(empty, true);
    subtitle.textContent = 'Sem alertas para os filtros selecionados';
    return;
  }

  show(wrap, true); show(empty, false);
  subtitle.textContent = `${items.length} produto${items.length !== 1 ? 's' : ''} para repor`;

  const STORE_SHORT = { albatroz: 'Alb', point: 'Point', tagus: 'Tagus' };

  const rows = items.map(item => {
    const color     = STORE_COLORS[item.store] || 'var(--text-secondary)';
    const urgentCls = item.cq === 0 ? ' row-urgent' : ' row-warning';

    const productStores = storeIdx.get(item.name.toLowerCase().trim())?.stores || {};
    const breakdown = STORES_ORDER.map(s => {
      const cq = productStores[s];
      if (cq === undefined) return null;
      const cls = cq === 0 ? 'qty-zero' : cq <= 3 ? 'qty-low' : 'qty-ok';
      return `<span class="breakdown-item"><span class="breakdown-dot" style="background:${STORE_COLORS[s]}"></span>${STORE_SHORT[s]} <span class="qty-badge qty-badge-xs ${cls}">${cq}</span></span>`;
    }).filter(Boolean).join('');

    return `
      <tr class="products-row${urgentCls}">
        <td class="cell-name">
          ${escHtml(item.name)}
          ${breakdown ? `<div class="store-breakdown">${breakdown}</div>` : ''}
        </td>
        <td><span class="supplier-badge">${escHtml(item.supplier)}</span></td>
        <td><span class="store-dot" style="--dot-color:${color}"></span>${escHtml(STORE_NAMES[item.store] || item.storeName)}</td>
        <td class="align-right"><span class="qty-badge ${item.cq === 0 ? 'qty-zero' : 'qty-low'}">${item.cq}</span></td>
      </tr>`;
  }).join('');

  tableEl.innerHTML = `
    <colgroup><col /><col style="width:130px" /><col style="width:140px" /><col style="width:72px" /></colgroup>
    <thead><tr>
      <th class="${thCls('name')}" data-col="name">Produto <span class="sort-arrow">↕</span></th>
      <th class="${thCls('supplier')}" data-col="supplier">Fornecedor <span class="sort-arrow">↕</span></th>
      <th class="${thCls('store')}" data-col="store">Loja <span class="sort-arrow">↕</span></th>
      <th class="${thCls('cq')} align-right" data-col="cq">Atual <span class="sort-arrow">↕</span></th>
    </tr></thead>
    <tbody>${rows}</tbody>`;

  buildSupplierFilter(stockData.low || [], false);
}

// Modo busca: todos os produtos agrupados, colunas por loja
function renderStockTableSearch(tableEl, storeIdx, empty, wrap, subtitle) {
  const q = stockSearchQuery.trim().toLowerCase();

  let matches = [...storeIdx.values()].filter(p => p.name.toLowerCase().includes(q));
  if (currentSupplier !== 'all') matches = matches.filter(p => p.supplier === currentSupplier);
  if (currentStore !== 'all')    matches = matches.filter(p => currentStore in p.stores);

  matches = matches.slice().sort((a, b) => {
    let va, vb;
    if (stockSortCol === 'supplier') { va = a.supplier; vb = b.supplier; }
    else                             { va = a.name;     vb = b.name; }
    const cmp = va.localeCompare(vb);
    return stockSortDir === 'asc' ? cmp : -cmp;
  });

  const allGrouped = [...storeIdx.values()];

  if (matches.length === 0) {
    show(wrap, false); show(empty, true);
    subtitle.textContent = `Nenhum resultado para "${stockSearchQuery}"`;
    buildSupplierFilter(allGrouped, true);
    return;
  }

  show(wrap, true); show(empty, false);
  subtitle.textContent = `${matches.length} produto${matches.length !== 1 ? 's' : ''} encontrado${matches.length !== 1 ? 's' : ''}`;

  const qEscaped = escHtml(stockSearchQuery.trim()).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const highlightRe = new RegExp(qEscaped, 'gi');

  const rows = matches.map(p => {
    const highlighted = escHtml(p.name).replace(highlightRe, m => `<mark>${m}</mark>`);
    const storeCells = STORES_ORDER.map(s => {
      const cq = p.stores[s];
      if (cq === undefined) return `<td class="align-right"><span class="qty-na">—</span></td>`;
      const cls = cq === 0 ? 'qty-zero' : cq <= 3 ? 'qty-low' : 'qty-ok';
      return `<td class="align-right"><span class="qty-badge ${cls}">${cq}</span></td>`;
    }).join('');

    return `
      <tr class="products-row">
        <td class="cell-name">${highlighted}</td>
        <td><span class="supplier-badge">${escHtml(p.supplier)}</span></td>
        ${storeCells}
      </tr>`;
  }).join('');

  const storeHeaders = STORES_ORDER.map(s =>
    `<th class="align-right" style="color:${STORE_COLORS[s]}">${STORE_NAMES[s]}</th>`
  ).join('');

  const storeCols = STORES_ORDER.map(() => `<col style="width:80px" />`).join('');
  tableEl.innerHTML = `
    <colgroup><col /><col style="width:130px" />${storeCols}</colgroup>
    <thead><tr>
      <th class="${thCls('name')}" data-col="name">Produto <span class="sort-arrow">↕</span></th>
      <th class="${thCls('supplier')}" data-col="supplier">Fornecedor <span class="sort-arrow">↕</span></th>
      ${storeHeaders}
    </tr></thead>
    <tbody>${rows}</tbody>`;

  buildSupplierFilter(allGrouped, true);
}

function buildSupplierFilter(items, isGrouped = false) {
  const container = document.getElementById('supplier-filter');
  if (!container) return;

  let filtered;
  if (currentStore === 'all') {
    filtered = items;
  } else if (isGrouped) {
    filtered = items.filter(i => currentStore in i.stores);
  } else {
    filtered = items.filter(i => i.store === currentStore);
  }

  const suppliers = [...new Set(filtered.map(i => i.supplier))].sort();

  const buttons = [
    makeFilterBtn('all', 'Todos', currentSupplier === 'all'),
    ...suppliers.map(s => makeFilterBtn(s, s, currentSupplier === s)),
  ];

  container.innerHTML = buttons.join('');

  container.querySelectorAll('.supplier-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentSupplier = btn.dataset.supplier;
      renderStockTable();
    });
  });
}

function makeFilterBtn(value, label, active) {
  return `<button class="supplier-btn${active ? ' active' : ''}" data-supplier="${escAttr(value)}">${escHtml(label)}</button>`;
}

// ── Seção de vendas por produto (busca + transações) ──────────────────────────

function renderProductsSection() {
  const noCart   = document.getElementById('products-no-cart');
  const initial  = document.getElementById('products-initial');
  const suggest  = document.getElementById('product-suggestions');
  const empty    = document.getElementById('products-empty');
  const detail   = document.getElementById('products-detail');
  const subtitle = document.getElementById('products-subtitle');

  const hide = (...els) => els.forEach(e => show(e, false));
  const states = [noCart, initial, suggest, empty, detail];

  if (!transactionsData) {
    hide(...states); show(initial, true);
    if (subtitle) subtitle.textContent = 'Busque um produto para ver suas transações';
    return;
  }

  if (!transactionsData.hasCartData) {
    hide(...states); show(noCart, true);
    return;
  }

  if (selectedProduct) {
    hide(...states); show(detail, true);
    renderTransactions();
    return;
  }

  const q = searchQuery.trim().toLowerCase();

  if (!q) {
    hide(...states); show(initial, true);
    if (subtitle) subtitle.textContent = 'Busque um produto para ver suas transações';
    return;
  }

  const allNames = new Map();
  for (const tx of transactionsData.transactions) {
    if (currentStore !== 'all' && tx.store !== currentStore) continue;
    for (const item of tx.items) {
      const key = item.name.toLowerCase().trim();
      if (key.includes(q) && !allNames.has(key)) allNames.set(key, item.name);
    }
  }

  const matches = [...allNames.values()].sort((a, b) => a.localeCompare(b));

  if (matches.length === 0) {
    hide(...states); show(empty, true);
    setText('search-term-label', searchQuery);
    if (subtitle) subtitle.textContent = 'Nenhum resultado encontrado';
    return;
  }

  hide(...states); show(suggest, true);
  if (subtitle) subtitle.textContent = `${matches.length} produto${matches.length !== 1 ? 's' : ''} encontrado${matches.length !== 1 ? 's' : ''}`;

  suggest.innerHTML = matches.map(name => {
    const highlighted = escHtml(name).replace(
      new RegExp(escHtml(searchQuery.trim()).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
      m => `<mark>${m}</mark>`
    );
    return `<li data-name="${escAttr(name)}">${highlighted}</li>`;
  }).join('');

  suggest.querySelectorAll('li').forEach(li => {
    li.addEventListener('click', () => {
      selectedProduct = li.dataset.name;
      searchQuery = li.dataset.name;
      const input = document.getElementById('product-search');
      if (input) input.value = selectedProduct;
      renderProductsSection();
    });
  });
}

function renderTransactions() {
  const tbody    = document.getElementById('transactions-tbody');
  const nameEl   = document.getElementById('detail-product-name');
  const statsEl  = document.getElementById('detail-stats');
  const subtitle = document.getElementById('products-subtitle');
  if (!tbody || !transactionsData) return;

  const productKey  = selectedProduct.toLowerCase().trim();
  const storeFilter = currentStore;

  const rows = [];
  for (const tx of transactionsData.transactions) {
    if (storeFilter !== 'all' && tx.store !== storeFilter) continue;
    for (const item of tx.items) {
      if (item.name.toLowerCase().trim() !== productKey) continue;
      rows.push({ date: tx.date, time: tx.time, store: tx.store, storeName: tx.storeName, qty: item.qty, unitPrice: item.unitPrice, total: item.total });
    }
  }

  const totalQty = rows.reduce((s, r) => s + r.qty, 0);
  const totalRev = rows.reduce((s, r) => s + r.total, 0);

  if (nameEl) nameEl.textContent = selectedProduct;
  if (statsEl) statsEl.textContent = `${rows.length} venda${rows.length !== 1 ? 's' : ''} · ${fmtNum(totalQty)} unid. · ${fmtBRL(totalRev)}`;
  if (subtitle) subtitle.textContent = `${rows.length} transaç${rows.length !== 1 ? 'ões' : 'ão'} encontrada${rows.length !== 1 ? 's' : ''}`;

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-muted)">Nenhuma transação para os filtros selecionados.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(r => {
    const color     = STORE_COLORS[r.store] || 'var(--text-secondary)';
    const storeName = STORE_NAMES[r.store] || r.storeName;
    const [, m, d]  = (r.date || '').split('-');
    const dateLabel = m && d ? `${d}/${m}` : r.date;
    return `
      <tr class="products-row">
        <td class="cell-muted">${escHtml(dateLabel)}</td>
        <td class="cell-muted">${escHtml(r.time || '—')}</td>
        <td><span class="store-dot" style="--dot-color:${color}"></span>${escHtml(storeName)}</td>
        <td class="align-right">${fmtNum(r.qty)}</td>
        <td class="align-right cell-revenue">${fmtBRL(r.total)}</td>
      </tr>`;
  }).join('');
}

// ── Filtros e eventos ──────────────────────────────────────────────────────────

function initStoreFilter() {
  document.querySelectorAll('.store-selector-produtos .store-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.store-selector-produtos .store-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentStore    = btn.dataset.store;
      currentSupplier = 'all';
      selectedProduct = null;
      renderStockKPIs();
      renderStockTable();
      renderProductsSection();
    });
  });
}

function initSearch() {
  const input = document.getElementById('product-search');
  const clear = document.getElementById('search-clear');
  if (!input) return;

  input.addEventListener('input', () => {
    searchQuery     = input.value;
    selectedProduct = null;
    show(clear, searchQuery.length > 0);
    renderProductsSection();
  });

  if (clear) {
    clear.addEventListener('click', () => {
      input.value     = '';
      searchQuery     = '';
      selectedProduct = null;
      show(clear, false);
      input.focus();
      renderProductsSection();
    });
  }

  document.getElementById('detail-back')?.addEventListener('click', () => {
    selectedProduct = null;
    renderProductsSection();
  });
}

function initStockSearch() {
  const input = document.getElementById('stock-search');
  const clear = document.getElementById('stock-search-clear');
  if (!input) return;

  input.addEventListener('input', () => {
    stockSearchQuery = input.value;
    show(clear, stockSearchQuery.length > 0);
    renderStockTable();
  });

  if (clear) {
    clear.addEventListener('click', () => {
      input.value      = '';
      stockSearchQuery = '';
      show(clear, false);
      input.focus();
      renderStockTable();
    });
  }
}

// Event delegation no <table> para lidar com rebuild de innerHTML
function initSortHeaders() {
  document.getElementById('stock-table')?.addEventListener('click', e => {
    const th = e.target.closest('.sortable[data-col]');
    if (!th) return;
    const col = th.dataset.col;
    if (stockSortCol === col) {
      stockSortDir = stockSortDir === 'asc' ? 'desc' : 'asc';
    } else {
      stockSortCol = col;
      stockSortDir = 'asc';
    }
    renderStockTable();
  });
}

// ── Utilitários ────────────────────────────────────────────────────────────────

function show(el, visible) {
  if (el) el.style.display = visible ? '' : 'none';
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(str) {
  return String(str ?? '').replace(/"/g, '&quot;');
}

// ── Init ───────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initStoreFilter();
  initSearch();
  initStockSearch();
  initSortHeaders();
  loadData();
});
