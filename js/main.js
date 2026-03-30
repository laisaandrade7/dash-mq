// ============================================
// MINHA QUITANDINHA — Dashboard JS
// ============================================

const STORE_COLORS = {
  albatroz: '#4f7cff',
  point:    '#1fd47a',
  tagus:    '#f0be3c',
};

// --- Helpers ---
function isMobile() { return window.innerWidth < 768; }

function fmtBRL(v) {
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtK(v) {
  return v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(v);
}

// --- Data atual no header ---
function setCurrentDate() {
  const el = document.getElementById('page-date');
  if (!el) return;
  const now = new Date();
  const opts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  el.textContent = now.toLocaleDateString('pt-BR', opts);
}

// --- Navegação entre páginas ---
function initNav() {
  const navItems  = document.querySelectorAll('.nav-item[data-page]');
  const pages     = document.querySelectorAll('.page');
  const pageTitle = document.getElementById('page-title');

  const titles = {
    overview: 'Visão Geral',
    sales:    'Vendas',
    history:  'Histórico',
    stock:    'Estoque',
    insights: 'Insights',
    settings: 'Configurações',
  };

  navItems.forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const target = item.dataset.page;
      navItems.forEach(n => n.classList.remove('active'));
      pages.forEach(p => p.classList.remove('active'));
      item.classList.add('active');
      const page = document.getElementById(`page-${target}`);
      if (page) page.classList.add('active');
      if (pageTitle && titles[target]) pageTitle.textContent = titles[target];
    });
  });
}

// --- Seletor de período ---
function initPeriodSelector() {
  const btns = document.querySelectorAll('.period-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

// --- Menu mobile ---
function initMobileMenu() {
  const btn     = document.getElementById('menu-btn');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (!btn || !sidebar || !overlay) return;

  function openMenu() {
    sidebar.classList.add('open');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  function closeMenu() {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  btn.addEventListener('click', openMenu);
  overlay.addEventListener('click', closeMenu);
  sidebar.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', closeMenu);
  });
}

// --- Botão de refresh ---
function initRefresh() {
  const btn = document.querySelector('.refresh-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    btn.classList.add('spinning');
    loadDashboard().finally(() => {
      setTimeout(() => btn.classList.remove('spinning'), 400);
    });
  });
}

// ─── Renderização ────────────────────────────────────────────────────────────

function renderKPIs(sales, history) {
  const today     = sales.date;
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yIso = yesterday.toISOString().split('T')[0];

  // Totais de ontem
  const yRecords = history.records.filter(r => r.date === yIso);
  const yFat = yRecords.reduce((s, r) => s + r.fat, 0);
  const yVnd = yRecords.reduce((s, r) => s + r.vnd, 0);
  const yTkt = yVnd > 0 ? yFat / yVnd : 0;

  function setKPI(valId, deltaId, value, prev, fmt) {
    const valEl   = document.getElementById(valId);
    const deltaEl = document.getElementById(deltaId);
    if (valEl) valEl.textContent = fmt(value);
    if (!deltaEl) return;

    if (prev === 0) {
      deltaEl.innerHTML = '<span style="opacity:.5">sem histórico</span>';
      deltaEl.className = 'kpi-delta';
      return;
    }
    const pct  = ((value - prev) / prev) * 100;
    const up   = pct >= 0;
    const arrow = up
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>';
    deltaEl.innerHTML = `${arrow} ${up ? '+' : ''}${pct.toFixed(1)}% vs ontem`;
    deltaEl.className = `kpi-delta ${up ? 'positive' : 'negative'}`;
  }

  const s = sales.summary;
  setKPI('kpi-fat-value', 'kpi-fat-delta', s.fat, yFat, fmtBRL);
  setKPI('kpi-vnd-value', 'kpi-vnd-delta', s.vnd, yVnd, v => String(v));
  setKPI('kpi-tkt-value', 'kpi-tkt-delta', s.tkt, yTkt, fmtBRL);
}

function renderRanking(sales) {
  const el = document.getElementById('ranking-list');
  if (!el) return;

  const stores  = sales.stores;
  const maxFat  = stores.length ? stores[0].fat : 1;

  el.innerHTML = stores.map((s, i) => {
    const pct   = maxFat > 0 ? (s.fat / maxFat) * 100 : 0;
    const color = STORE_COLORS[s.key] || '#8892aa';
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
    return `
      <div class="ranking-item">
        <div class="ranking-pos">${medal}</div>
        <div class="ranking-info">
          <div class="ranking-name">${s.name}</div>
          <div class="ranking-bar-wrap">
            <div class="ranking-bar" style="width:${pct.toFixed(1)}%;background:${color}"></div>
          </div>
        </div>
        <div class="ranking-value">${fmtBRL(s.fat)}</div>
      </div>`;
  }).join('');
}

function renderTickets(sales) {
  const el = document.getElementById('ticket-list');
  if (!el) return;

  const stores = [...sales.stores].sort((a, b) => b.tkt - a.tkt);
  const maxTkt = stores.length ? stores[0].tkt : 1;

  el.innerHTML = stores.map(s => {
    const pct   = maxTkt > 0 ? (s.tkt / maxTkt) * 100 : 0;
    const color = STORE_COLORS[s.key] || '#8892aa';
    return `
      <div class="ticket-item">
        <div class="ticket-name">${s.name}</div>
        <div class="ticket-bar-wrap">
          <div class="ticket-bar" style="width:${pct.toFixed(1)}%;background:${color}"></div>
        </div>
        <div class="ticket-value">${fmtBRL(s.tkt)}</div>
      </div>`;
  }).join('');
}

function renderInsights(sales, history) {
  const el = document.getElementById('insights-list');
  if (!el) return;

  const insights = [];
  const stores   = sales.stores;

  // 1. Loja líder do dia
  if (stores.length > 0) {
    const leader = stores[0];
    insights.push({
      icon: '🏆',
      text: `<strong>${leader.name}</strong> lidera o dia com ${fmtBRL(leader.fat)}.`,
    });
  }

  // 2. Comparação com ontem
  const today = sales.date;
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yIso = yesterday.toISOString().split('T')[0];
  const yFat = history.records.filter(r => r.date === yIso).reduce((s, r) => s + r.fat, 0);
  if (yFat > 0) {
    const pct = ((sales.summary.fat - yFat) / yFat) * 100;
    const dir = pct >= 0 ? 'acima' : 'abaixo';
    const emoji = pct >= 0 ? '📈' : '📉';
    insights.push({
      icon: emoji,
      text: `Faturamento ${Math.abs(pct).toFixed(1)}% ${dir} do dia anterior (${fmtBRL(yFat)}).`,
    });
  }

  // 3. Loja com melhor ticket médio
  if (stores.length > 1) {
    const bestTkt = [...stores].sort((a, b) => b.tkt - a.tkt)[0];
    insights.push({
      icon: '🎯',
      text: `<strong>${bestTkt.name}</strong> tem o melhor ticket médio: ${fmtBRL(bestTkt.tkt)}/venda.`,
    });
  }

  if (insights.length === 0) {
    insights.push({ icon: 'ℹ️', text: 'Sem dados suficientes para gerar insights hoje.' });
  }

  el.innerHTML = insights.map(ins => `
    <div class="insight-item">
      <span class="insight-icon">${ins.icon}</span>
      <span class="insight-text">${ins.text}</span>
    </div>`).join('');
}

// --- Gráfico comparativo (Chart.js) ---
let chartInstance = null;

function initChart(history) {
  const canvas = document.getElementById('chart-lojas');
  if (!canvas || typeof Chart === 'undefined') return;

  const last7      = history.dates.slice(-7);
  const labels     = last7.map(d => { const [,m,day] = d.split('-'); return `${day}/${m}`; });
  const storeKeys  = history.stores;
  const storeNames = {};
  history.records.forEach(r => { storeNames[r.store] = r.name; });

  const mobile = isMobile();
  // Alternância top/bottom por loja para evitar sobreposição de rótulos
  const LABEL_POS = ['top', 'bottom', 'top'];

  Chart.register(ChartDataLabels);

  const datasets = storeKeys.map((key, idx) => {
    const color = STORE_COLORS[key] || '#8892aa';
    const hex   = color.replace('#', '');
    const rv    = parseInt(hex.slice(0,2),16);
    const gv    = parseInt(hex.slice(2,4),16);
    const bv    = parseInt(hex.slice(4,6),16);
    const data  = last7.map(date => {
      const rec = history.records.find(r => r.date === date && r.store === key);
      return rec ? rec.fat : 0;
    });
    const align = LABEL_POS[idx % LABEL_POS.length];
    return {
      label:               storeNames[key] || key,
      data,
      borderColor:         color,
      backgroundColor:     `rgba(${rv},${gv},${bv},0.08)`,
      borderWidth:         2,
      pointRadius:         mobile ? 2 : 3,
      pointHoverRadius:    5,
      pointBackgroundColor:      color,
      pointHoverBackgroundColor: color,
      pointHoverBorderColor:     '#141820',
      pointHoverBorderWidth:     2,
      tension:             0.4,
      fill:                true,
      datalabels: {
        display:   !mobile,
        color:     color,
        font:      { family: 'Inter', size: 9, weight: '700' },
        formatter: v => v > 0 ? fmtK(v) : '',
        anchor:    align === 'top' ? 'end' : 'start',
        align,
        offset:    3,
        clamp:     true,
      },
    };
  });

  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      interaction:         { mode: 'index', intersect: false },
      layout:              { padding: { top: mobile ? 8 : 22, right: 4, bottom: 0, left: 0 } },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color:         '#8892aa',
            font:          { family: 'Inter', size: mobile ? 10 : 11 },
            boxWidth:      8,
            boxHeight:     8,
            borderRadius:  2,
            padding:       mobile ? 10 : 14,
            usePointStyle: true,
            pointStyle:    'circle',
          },
        },
        tooltip: {
          backgroundColor: '#1a1e2a',
          borderColor:     '#2d3550',
          borderWidth:     1,
          titleColor:      '#eef0f6',
          bodyColor:       '#8892aa',
          padding:         { x: 14, y: 10 },
          caretSize:       5,
          cornerRadius:    8,
          callbacks: {
            label: ctx => `  ${ctx.dataset.label}: ${fmtBRL(ctx.parsed.y)}`,
            labelColor: ctx => ({
              borderColor:     'transparent',
              backgroundColor: ctx.dataset.borderColor,
              borderRadius:    3,
            }),
          },
        },
      },
      scales: {
        x: {
          grid:   { color: 'rgba(255,255,255,0.04)', drawBorder: false },
          ticks:  { color: '#555e75', font: { family: 'Inter', size: mobile ? 10 : 11 }, maxRotation: 0, padding: 6 },
          border: { display: false },
        },
        y: {
          grid:   { color: 'rgba(255,255,255,0.04)', drawBorder: false },
          ticks: {
            color:         '#555e75',
            font:          { family: 'Inter', size: mobile ? 10 : 11 },
            maxTicksLimit: mobile ? 4 : 5,
            padding:       8,
            callback:      v => v === 0 ? '' : 'R$' + (v >= 1000 ? (v/1000).toFixed(1)+'k' : v),
          },
          border: { display: false },
        },
      },
    },
  });
}

// ─── Carregamento de dados ────────────────────────────────────────────────────

async function loadDashboard() {
  try {
    const [salesRes, historyRes] = await Promise.all([
      fetch('data/sales.json',   { cache: 'no-store' }),
      fetch('data/history.json', { cache: 'no-store' }),
    ]);

    if (!salesRes.ok || !historyRes.ok) throw new Error('Falha ao carregar dados.');

    const sales   = await salesRes.json();
    const history = await historyRes.json();

    renderKPIs(sales, history);
    renderRanking(sales);
    renderTickets(sales);
    renderInsights(sales, history);
    initChart(history);
  } catch (err) {
    console.error('[dashboard] Erro ao carregar dados:', err.message);
    ['kpi-fat-value','kpi-vnd-value','kpi-tkt-value'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = 'erro';
    });
    ['kpi-fat-delta','kpi-vnd-delta','kpi-tkt-delta'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = 'Rode npm run sync para gerar dados';
    });
  }
}

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
  setCurrentDate();
  initNav();
  initPeriodSelector();
  initRefresh();
  initMobileMenu();
  loadDashboard();
});
