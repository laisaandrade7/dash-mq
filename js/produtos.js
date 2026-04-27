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
};

const STORE_COLORS = {
  albatroz: '#4f7cff',
  point:    '#1fd47a',
  tagus:    '#f5c842',
};

// ── Estado global ──────────────────────────────────────────────────────────────

let stockData        = null;
let transactionsData = null;
let currentStore    = 'all';
let currentSupplier = 'all';
let searchQuery     = '';
let selectedProduct = null;
let stockSortCol = 'cq';
let stockSortDir = 'asc';

// ── Fetch de dados ─────────────────────────────────────────────────────────────

async function loadData() {
  try {
    const [stockRes, txRes] = await Promise.all([
      fetch('data/stock.json'),
      fetch('data/transactions.json'),
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

  const filteredLow = currentStore === 'all'
    ? stockData.totalLow
    : (byStore[currentStore]?.low ?? 0);

  const filteredTotal = currentStore === 'all'
    ? stockData.totalProducts
    : (byStore[currentStore]?.total ?? 0);

  setText('kpi-total-low',       filteredLow);
  setText('kpi-total-products',  filteredTotal);
  setText('kpi-low-albatroz',    byStore.albatroz?.low ?? '—');
  setText('kpi-low-point',       byStore.point?.low    ?? '—');
  setText('kpi-low-tagus',       byStore.tagus?.low    ?? '—');
}

// ── Tabela de alertas ──────────────────────────────────────────────────────────

function renderStockTable() {
  const tbody    = document.getElementById('stock-tbody');
  const empty    = document.getElementById('stock-empty');
  const wrap     = document.getElementById('stock-table-wrap');
  const subtitle = document.getElementById('stock-subtitle');
  if (!tbody) return;

  if (!stockData) {
    tbody.innerHTML = '';
    show(wrap, false); show(empty, false);
    return;
  }

  let items = (stockData.low || []).filter(i => i.cq <= 3);
  if (currentStore !== 'all')    items = items.filter(i => i.store === currentStore);
  if (currentSupplier !== 'all') items = items.filter(i => i.supplier === currentSupplier);

  items = items.slice().sort((a, b) => {
    let va, vb;
    if (stockSortCol === 'name')     { va = a.name;     vb = b.name; }
    else if (stockSortCol === 'supplier') { va = a.supplier; vb = b.supplier; }
    else if (stockSortCol === 'store')    { va = STORE_NAMES[a.store] || a.store; vb = STORE_NAMES[b.store] || b.store; }
    else                             { va = a.cq;       vb = b.cq; }
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

  tbody.innerHTML = items.map(item => {
    const falta  = item.iq - item.cq;
    const color  = STORE_COLORS[item.store] || 'var(--text-secondary)';
    const urgent = item.cq === 0 ? ' row-urgent' : (falta >= item.iq ? ' row-warning' : '');
    return `
      <tr class="products-row${urgent}">
        <td class="cell-name">${escHtml(item.name)}</td>
        <td><span class="supplier-badge">${escHtml(item.supplier)}</span></td>
        <td><span class="store-dot" style="--dot-color:${color}"></span>${escHtml(STORE_NAMES[item.store] || item.storeName)}</td>
        <td class="align-right"><span class="qty-badge ${item.cq === 0 ? 'qty-zero' : 'qty-low'}">${item.cq}</span></td>
      </tr>`;
  }).join('');

  buildSupplierFilter(stockData.low || []);
  updateStockSortHeaders();
}

function buildSupplierFilter(allLowItems) {
  const container = document.getElementById('supplier-filter');
  if (!container) return;

  const filtered = currentStore === 'all'
    ? allLowItems
    : allLowItems.filter(i => i.store === currentStore);

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

  // Coleta nomes únicos de produtos que batem com a query
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

  const productKey = selectedProduct.toLowerCase().trim();
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
    const color = STORE_COLORS[r.store] || 'var(--text-secondary)';
    const storeName = STORE_NAMES[r.store] || r.storeName;
    const [, m, d] = (r.date || '').split('-');
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

function updateStockSortHeaders() {
  document.querySelectorAll('#stock-table .sortable').forEach(th => {
    th.classList.toggle('sort-active', th.dataset.col === stockSortCol);
    th.classList.toggle('sort-asc', th.dataset.col === stockSortCol && stockSortDir === 'asc');
    th.classList.toggle('sort-desc', th.dataset.col === stockSortCol && stockSortDir === 'desc');
  });
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

function initSortHeaders() {
  document.querySelectorAll('#stock-table .sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (stockSortCol === col) {
        stockSortDir = stockSortDir === 'asc' ? 'desc' : 'asc';
      } else {
        stockSortCol = col;
        stockSortDir = 'asc';
      }
      renderStockTable();
    });
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
  initSortHeaders();
  loadData();
});
