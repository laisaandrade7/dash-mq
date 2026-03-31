// ============================================
// MINHA QUITANDINHA — Dashboard JS
// ============================================

const STORE_COLORS = {
  albatroz: '#4f7cff',
  point:    '#1fd47a',
  tagus:    '#f0be3c',
};

// --- Module state ---
let salesData    = null;
let historyData  = null;
let currentPeriod = 'today';
let customRange   = null; // { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' }

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

// --- Aggregate history records into sales-like summary ---
function aggregateHistory(records) {
  const byStore = {};
  records.forEach(r => {
    if (!byStore[r.store]) byStore[r.store] = { key: r.store, name: r.name, fat: 0, vnd: 0 };
    byStore[r.store].fat += r.fat;
    byStore[r.store].vnd += r.vnd;
  });
  const stores = Object.values(byStore)
    .map(s => ({ ...s, tkt: s.vnd > 0 ? s.fat / s.vnd : 0 }))
    .sort((a, b) => b.fat - a.fat);
  const fat = stores.reduce((s, r) => s + r.fat, 0);
  const vnd = stores.reduce((s, r) => s + r.vnd, 0);
  return { summary: { fat, vnd, tkt: vnd > 0 ? fat / vnd : 0 }, stores };
}

// --- Get dates for current period ---
function getPeriodDates() {
  if (customRange) {
    return (historyData.dates || []).filter(d => d >= customRange.from && d <= customRange.to);
  }
  if (currentPeriod === 'today') return [salesData.date];
  return (historyData.dates || []).slice(-parseInt(currentPeriod));
}

// --- Get previous period dates for comparison ---
function getPrevPeriodDates() {
  const dates = historyData.dates || [];
  if (customRange) {
    const span = Math.round((new Date(customRange.to) - new Date(customRange.from)) / 86400000) + 1;
    const prevTo = new Date(customRange.from);
    prevTo.setDate(prevTo.getDate() - 1);
    const prevFrom = new Date(prevTo);
    prevFrom.setDate(prevFrom.getDate() - span + 1);
    return dates.filter(d => d >= prevFrom.toISOString().split('T')[0] && d <= prevTo.toISOString().split('T')[0]);
  }
  if (currentPeriod === 'today') {
    const yesterday = new Date(salesData.date);
    yesterday.setDate(yesterday.getDate() - 1);
    return [yesterday.toISOString().split('T')[0]];
  }
  const n     = parseInt(currentPeriod);
  const end   = dates.length - n;
  const start = Math.max(0, end - n);
  return dates.slice(start, end);
}

// --- Render dispatcher ---
function renderAll() {
  if (!salesData || !historyData) return;
  const isToday = currentPeriod === 'today' && !customRange;

  if (isToday) {
    updateSubtitles('Faturamento hoje', 'Últimos 7 dias');
    updateKPILabels('Faturamento do Dia', 'Vendas Aprovadas', 'Ticket Médio');
    renderKPIs(salesData, historyData);
    renderRanking(salesData.stores);
    renderTickets(salesData.stores);
    renderInsights(salesData, historyData);
    const chartDates = (historyData.dates || []).slice(-7);
    try { initChart(historyData, chartDates); } catch (e) { console.error('[chart]', e.message); }
  } else {
    const dates       = getPeriodDates();
    const prevDates   = getPrevPeriodDates();
    const records     = (historyData.records || []).filter(r => dates.includes(r.date));
    const prevRecords = (historyData.records || []).filter(r => prevDates.includes(r.date));
    const agg         = aggregateHistory(records);
    const prevAgg     = aggregateHistory(prevRecords);

    const periodLabel = customRange
      ? `${customRange.from.slice(5).split('-').reverse().join('/')} a ${customRange.to.slice(5).split('-').reverse().join('/')}`
      : `Últimos ${currentPeriod} dias`;
    updateSubtitles('Faturamento do período', periodLabel);
    updateKPILabels('Faturamento do Período', 'Vendas Aprovadas', 'Ticket Médio');
    renderKPIsPeriod(agg, prevAgg);
    renderRanking(agg.stores);
    renderTickets(agg.stores);
    renderInsightsPeriod(agg, prevAgg);
    try { initChart(historyData, dates); } catch (e) { console.error('[chart]', e.message); }
  }
}

function updateSubtitles(rankingText, chartText) {
  const rs = document.getElementById('ranking-subtitle');
  const cs = document.getElementById('chart-subtitle');
  if (rs) rs.textContent = rankingText;
  if (cs) cs.textContent = chartText;
}

function updateKPILabels(fatLabel, vndLabel, tktLabel) {
  const labels = document.querySelectorAll('.kpi-label');
  if (labels[0]) labels[0].textContent = fatLabel;
  if (labels[1]) labels[1].textContent = vndLabel;
  if (labels[2]) labels[2].textContent = tktLabel;
}

// ─── Renderização ────────────────────────────────────────────────────────────

function renderKPIs(sales, history) {
  const today     = sales.date;
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yIso = yesterday.toISOString().split('T')[0];

  const yRecords = (history.records || []).filter(r => r.date === yIso);
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

function renderKPIsPeriod(agg, prevAgg) {
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
    const pct = ((value - prev) / prev) * 100;
    const up  = pct >= 0;
    const arrow = up
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>';
    deltaEl.innerHTML = `${arrow} ${up ? '+' : ''}${pct.toFixed(1)}% vs período anterior`;
    deltaEl.className = `kpi-delta ${up ? 'positive' : 'negative'}`;
  }

  const s = agg.summary;
  const p = prevAgg.summary;
  setKPI('kpi-fat-value', 'kpi-fat-delta', s.fat, p.fat, fmtBRL);
  setKPI('kpi-vnd-value', 'kpi-vnd-delta', s.vnd, p.vnd, v => String(Math.round(v)));
  setKPI('kpi-tkt-value', 'kpi-tkt-delta', s.tkt, p.tkt, fmtBRL);
}

function renderRanking(stores) {
  const el = document.getElementById('ranking-list');
  if (!el) return;
  const maxFat = stores.length ? stores[0].fat : 1;
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

function renderTickets(stores) {
  const el = document.getElementById('ticket-list');
  if (!el) return;
  const sorted = [...stores].sort((a, b) => b.tkt - a.tkt);
  const maxTkt = sorted.length ? sorted[0].tkt : 1;
  el.innerHTML = sorted.map(s => {
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

  if (stores.length > 0) {
    insights.push({
      icon: '🏆',
      text: `<strong>${stores[0].name}</strong> lidera o dia com ${fmtBRL(stores[0].fat)}.`,
    });
  }

  const today = sales.date;
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yIso = yesterday.toISOString().split('T')[0];
  const yFat = (history.records || []).filter(r => r.date === yIso).reduce((s, r) => s + r.fat, 0);
  if (yFat > 0) {
    const pct   = ((sales.summary.fat - yFat) / yFat) * 100;
    const emoji = pct >= 0 ? '📈' : '📉';
    insights.push({
      icon: emoji,
      text: `Faturamento ${Math.abs(pct).toFixed(1)}% ${pct >= 0 ? 'acima' : 'abaixo'} do dia anterior (${fmtBRL(yFat)}).`,
    });
  }

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

function renderInsightsPeriod(agg, prevAgg) {
  const el = document.getElementById('insights-list');
  if (!el) return;
  const stores   = agg.stores;
  const insights = [];

  if (stores.length > 0) {
    insights.push({
      icon: '🏆',
      text: `<strong>${stores[0].name}</strong> lidera o período com ${fmtBRL(stores[0].fat)}.`,
    });
  }

  const prevFat = prevAgg.summary.fat;
  if (prevFat > 0) {
    const pct   = ((agg.summary.fat - prevFat) / prevFat) * 100;
    const emoji = pct >= 0 ? '📈' : '📉';
    insights.push({
      icon: emoji,
      text: `Faturamento ${Math.abs(pct).toFixed(1)}% ${pct >= 0 ? 'acima' : 'abaixo'} do período anterior (${fmtBRL(prevFat)}).`,
    });
  }

  if (stores.length > 1) {
    const bestTkt = [...stores].sort((a, b) => b.tkt - a.tkt)[0];
    insights.push({
      icon: '🎯',
      text: `<strong>${bestTkt.name}</strong> tem o melhor ticket médio: ${fmtBRL(bestTkt.tkt)}/venda.`,
    });
  }

  el.innerHTML = insights.map(ins => `
    <div class="insight-item">
      <span class="insight-icon">${ins.icon}</span>
      <span class="insight-text">${ins.text}</span>
    </div>`).join('');
}

// --- Gráfico comparativo (Chart.js) ---
let chartInstance = null;

function initChart(history, dates) {
  const canvas = document.getElementById('chart-lojas');
  if (!canvas || typeof Chart === 'undefined') return;

  const chartDates = dates || (history.dates || []).slice(-7);
  const labels     = chartDates.map(d => { const [,m,day] = d.split('-'); return `${day}/${m}`; });
  const storeKeys  = history.stores || [];
  const storeNames = {};
  (history.records || []).forEach(r => { storeNames[r.store] = r.name; });

  const mobile    = isMobile();
  const LABEL_POS = ['top', 'bottom', 'top'];

  Chart.register(ChartDataLabels);

  const datasets = storeKeys.map((key, idx) => {
    const color = STORE_COLORS[key] || '#8892aa';
    const hex   = color.replace('#', '');
    const rv    = parseInt(hex.slice(0,2),16);
    const gv    = parseInt(hex.slice(2,4),16);
    const bv    = parseInt(hex.slice(4,6),16);
    const data  = chartDates.map(date => {
      const rec = (history.records || []).find(r => r.date === date && r.store === key);
      return rec ? rec.fat : 0;
    });
    const align = LABEL_POS[idx % LABEL_POS.length];
    return {
      label:                     storeNames[key] || key,
      data,
      borderColor:               color,
      backgroundColor:           `rgba(${rv},${gv},${bv},0.08)`,
      borderWidth:               2,
      pointRadius:               mobile ? 2 : 3,
      pointHoverRadius:          5,
      pointBackgroundColor:      color,
      pointHoverBackgroundColor: color,
      pointHoverBorderColor:     '#141820',
      pointHoverBorderWidth:     2,
      tension:                   0.4,
      fill:                      true,
      datalabels: {
        display: (ctx) => {
          const v = ctx.dataset.data[ctx.dataIndex];
          if (mobile) return ctx.dataIndex === chartDates.length - 1 && v > 0;
          return chartDates.length <= 15 && v > 0;
        },
        color,
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
      layout:              { padding: { top: mobile ? 24 : 22, right: 4, bottom: 0, left: 0 } },
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
          ticks:  {
            color:        '#555e75',
            font:         { family: 'Inter', size: mobile ? 10 : 11 },
            maxRotation:  0,
            padding:      6,
            maxTicksLimit: mobile ? 6 : (chartDates.length > 15 ? 10 : undefined),
          },
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
    salesData   = await salesRes.json();
    historyData = await historyRes.json();
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
    return;
  }
  renderAll();
  setLastSync(salesData.generatedAt);
}

// --- Rótulo de última atualização ---
function setLastSync(isoTimestamp) {
  const el = document.getElementById('last-sync-label');
  if (!el || !isoTimestamp) return;
  const d = new Date(isoTimestamp);
  // Converte UTC → BRT (UTC-3)
  d.setTime(d.getTime() - 3 * 60 * 60 * 1000);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const mon = String(d.getUTCMonth() + 1).padStart(2, '0');
  el.textContent = `Atualizado ${day}/${mon} às ${hh}:${mm}`;
}

// --- Navegação entre páginas ---
function initNav() {
  const navItems  = document.querySelectorAll('.nav-item[data-page]');
  const pages     = document.querySelectorAll('.page');
  const pageTitle = document.getElementById('page-title');

  const titles = {
    overview: 'Visão Geral',
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
      currentPeriod = btn.dataset.period;
      customRange   = null;
      const drLabel = document.getElementById('date-range-label');
      const drBtn   = document.getElementById('date-range-btn');
      if (drLabel) drLabel.textContent = 'Personalizado';
      if (drBtn)   drBtn.classList.remove('active');
      renderAll();
    });
  });
}

// --- Date range picker ---
function initDateRangePicker() {
  const btn       = document.getElementById('date-range-btn');
  const popover   = document.getElementById('date-range-popover');
  const fromInput = document.getElementById('date-from');
  const toInput   = document.getElementById('date-to');
  const applyBtn  = document.getElementById('date-range-apply');
  const clearBtn  = document.getElementById('date-range-clear');
  const label     = document.getElementById('date-range-label');

  if (!btn || !popover) return;

  btn.addEventListener('click', e => {
    e.stopPropagation();
    popover.classList.toggle('open');
  });
  document.addEventListener('click', () => popover.classList.remove('open'));
  popover.addEventListener('click', e => e.stopPropagation());

  applyBtn.addEventListener('click', () => {
    const from = fromInput.value;
    const to   = toInput.value;
    if (!from || !to || from > to) return;
    const fmtD = d => d.slice(5).split('-').reverse().join('/');
    label.textContent = `${fmtD(from)} — ${fmtD(to)}`;
    btn.classList.add('active');
    popover.classList.remove('open');
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    customRange   = { from, to };
    currentPeriod = 'custom';
    renderAll();
  });

  clearBtn.addEventListener('click', () => {
    fromInput.value = '';
    toInput.value   = '';
    label.textContent = 'Personalizado';
    btn.classList.remove('active');
    popover.classList.remove('open');
    customRange   = null;
    currentPeriod = 'today';
    const todayBtn = document.querySelector('.period-btn[data-period="today"]');
    if (todayBtn) todayBtn.classList.add('active');
    renderAll();
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

  const bottomMenuBtn = document.getElementById('bottom-menu-btn');
  if (bottomMenuBtn) bottomMenuBtn.addEventListener('click', openMenu);
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

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
  setCurrentDate();
  initNav();
  initPeriodSelector();
  initDateRangePicker();
  initRefresh();
  initMobileMenu();
  loadDashboard();
});
