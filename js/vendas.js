// ============================================
// VENDAS — dados mockados e lógica da página
// ============================================

// --- Helpers ---
function isMobile() { return window.innerWidth < 768; }
function fmtK(v)    { return v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(v); }

// --- Paleta de cores consistente com main.css ---
const COLORS = {
  albatroz: { line: '#4f7cff', bar: 'rgba(79,124,255,0.8)',  bg: 'rgba(79,124,255,0.1)'  },
  point:    { line: '#22d37a', bar: 'rgba(34,211,122,0.8)',  bg: 'rgba(34,211,122,0.08)' },
  tagus:    { line: '#f5c842', bar: 'rgba(245,200,66,0.8)',  bg: 'rgba(245,200,66,0.07)' },
};

// --- Geração de dados mockados ---
function generateData(days) {
  const records = [];
  const now = new Date();

  for (let d = days - 1; d >= 0; d--) {
    const date = new Date(now);
    date.setDate(now.getDate() - d);
    const label = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const iso   = date.toISOString().split('T')[0];

    const stores = [
      { key: 'albatroz', name: 'Albatroz',       base: 1800, variance: 400 },
      { key: 'point',    name: 'The Point',       base: 1450, variance: 300 },
      { key: 'tagus',    name: 'Tagus II',        base: 1200, variance: 280 },
    ];

    stores.forEach(s => {
      const fat  = Math.round((s.base + (Math.random() - 0.4) * s.variance) * 100) / 100;
      const vnd  = Math.round(35 + Math.random() * 20);
      const tkt  = Math.round((fat / vnd) * 100) / 100;
      records.push({ date: iso, label, store: s.key, name: s.name, fat, vnd, tkt });
    });
  }
  return records;
}

// --- Registro do plugin datalabels ---
if (typeof ChartDataLabels !== 'undefined') {
  Chart.register(ChartDataLabels);
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

// --- Dados reais (carregados do history.json) ---
let ALL_RECORDS = [];
let ALL_DATES   = [];

// --- Estado atual ---
let currentPeriod   = 7;
let currentStore    = 'all';
let customDateRange = null; // { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' }
let chartEvolucao   = null;
let chartTicket     = null;

// --- Helpers de período ---
function monthDates() {
  const now   = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const today = now.toISOString().split('T')[0];
  return ALL_DATES.filter(d => d >= first && d <= today);
}

function prevMonthDates() {
  const now   = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
  const last  = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
  return ALL_DATES.filter(d => d >= first && d <= last);
}

// --- Filtragem ---
function filterData(period, store) {
  let dates;
  if (customDateRange) {
    dates = ALL_DATES.filter(d => d >= customDateRange.from && d <= customDateRange.to);
  } else {
    dates = period === 'month' ? monthDates() : ALL_DATES.slice(-period);
  }
  return ALL_RECORDS.filter(r => dates.includes(r.date) && (store === 'all' || r.store === store));
}

function prevData(period) {
  let dates;
  if (customDateRange) {
    const span    = Math.round((new Date(customDateRange.to) - new Date(customDateRange.from)) / 86400000) + 1;
    const prevTo  = new Date(customDateRange.from);
    prevTo.setDate(prevTo.getDate() - 1);
    const prevFrom = new Date(prevTo);
    prevFrom.setDate(prevFrom.getDate() - span + 1);
    dates = ALL_DATES.filter(d => d >= prevFrom.toISOString().split('T')[0] && d <= prevTo.toISOString().split('T')[0]);
  } else if (period === 'month') {
    dates = prevMonthDates();
  } else {
    const end   = ALL_DATES.length - period;
    const start = Math.max(0, end - period);
    dates = ALL_DATES.slice(start, end);
  }
  return ALL_RECORDS.filter(r => dates.includes(r.date));
}

// --- Helpers numéricos ---
function fmtBRL(v) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtPct(v) {
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(1)}%`;
}

function sum(arr, key) { return arr.reduce((a, b) => a + b[key], 0); }

// --- Chart.js defaults compartilhados ---
const CHART_DEFAULTS = {
  tooltip: {
    backgroundColor: '#1a1e2a',
    borderColor: '#252a38',
    borderWidth: 1,
    titleColor: '#f0f2f8',
    bodyColor: '#8892aa',
    padding: 12,
    cornerRadius: 6,
  },
  legend: {
    labels: {
      color: '#8892aa',
      font: { family: 'Inter', size: 11 },
      boxWidth: 10, boxHeight: 10,
      borderRadius: 2, padding: 16,
      usePointStyle: true, pointStyle: 'circle',
    },
  },
  scales: {
    x: {
      grid: { color: '#1a1e2a', drawBorder: false },
      ticks: { color: '#555e75', font: { family: 'Inter', size: 11 } },
      border: { display: false },
    },
    y: {
      grid: { color: '#1a1e2a', drawBorder: false },
      ticks: { color: '#555e75', font: { family: 'Inter', size: 11 } },
      border: { display: false },
    },
  },
};

// --- Atualiza KPIs ---
function updateKPIs(data, period) {
  const fat  = sum(data, 'fat');
  const vnd  = sum(data, 'vnd');
  const tkt  = vnd > 0 ? fat / vnd : 0;

  const prev = prevData(period);
  const fatPrev = sum(prev, 'fat');
  const varPct  = fatPrev > 0 ? ((fat - fatPrev) / fatPrev) * 100 : 0;

  document.getElementById('kpi-faturamento').textContent = fmtBRL(fat);
  document.getElementById('kpi-vendas').textContent      = vnd.toLocaleString('pt-BR');
  document.getElementById('kpi-ticket').textContent      = fmtBRL(tkt);
  document.getElementById('kpi-variacao').textContent    = fmtPct(varPct);

  const fatDelta = document.getElementById('kpi-fat-delta');
  fatDelta.className = `kpi-delta ${varPct >= 0 ? 'positive' : 'negative'}`;
  fatDelta.querySelector('span').textContent = `${fmtPct(varPct)} vs período anterior`;

  const vndPrev = sum(prev, 'vnd');
  const vndVar  = vndPrev > 0 ? ((vnd - vndPrev) / vndPrev) * 100 : 0;
  const vndDelta = document.getElementById('kpi-vnd-delta');
  vndDelta.className = `kpi-delta ${vndVar >= 0 ? 'positive' : 'negative'}`;
  vndDelta.querySelector('span').textContent = `${fmtPct(vndVar)} vs período anterior`;

  const tktPrev = sum(prev, 'vnd') > 0 ? sum(prev, 'fat') / sum(prev, 'vnd') : 0;
  const tktVar  = tktPrev > 0 ? ((tkt - tktPrev) / tktPrev) * 100 : 0;
  const tktDelta = document.getElementById('kpi-tkt-delta');
  tktDelta.className = `kpi-delta ${tktVar >= 0 ? 'positive' : 'negative'}`;
  tktDelta.querySelector('span').textContent = `${fmtPct(tktVar)} vs período anterior`;

  const varDelta = document.getElementById('kpi-variacao');
  varDelta.className = `kpi-value ${varPct >= 0 ? '' : 'negative-val'}`;
  varDelta.style.color = varPct >= 0 ? 'var(--green)' : 'var(--red)';
}

// --- Gráfico: evolução de faturamento ---
function buildEvolucao(data, period) {
  let dates;
  if (customDateRange) {
    dates = ALL_DATES.filter(d => d >= customDateRange.from && d <= customDateRange.to);
  } else {
    dates = period === 'month' ? monthDates() : ALL_DATES.slice(-period);
  }
  const labels = dates.map(d => {
    const r = ALL_RECORDS.find(x => x.date === d);
    return r ? r.label : d.slice(5).split('-').reverse().join('/');
  });

  const storeKeys  = currentStore === 'all' ? ['albatroz', 'point', 'tagus'] : [currentStore];
  const storeNames = { albatroz: 'Albatroz', point: 'The Point', tagus: 'Tagus II' };

  const mobile     = isMobile();
  const showLabels = customDateRange ? dates.length <= 7 : (period !== 'month' && period <= 7);

  const datasets = storeKeys.map(key => {
    const c = COLORS[key];
    return {
      label: storeNames[key],
      data: dates.map(d => {
        const r = data.find(x => x.date === d && x.store === key);
        return r ? r.fat : null;
      }),
      borderColor: c.line,
      backgroundColor: c.bg,
      borderWidth: 2,
      pointRadius: mobile ? 2 : (dates.length <= 7 ? 4 : 2),
      pointHoverRadius: 6,
      tension: 0.4,
      fill: true,
      spanGaps: true,
      datalabels: {
        display: (ctx) => {
          if (!showLabels) return false;
          if (mobile) return ctx.dataIndex === 0 || ctx.dataIndex === labels.length - 1;
          return true;
        },
        color: c.line,
        font: { family: 'Inter', size: mobile ? 9 : 10, weight: '700' },
        formatter: v => v != null ? fmtK(v) : '',
        anchor: 'end',
        align: 'top',
        offset: 2,
        clamp: true,
      },
    };
  });

  const now = new Date();
  const monthName = now.toLocaleDateString('pt-BR', { month: 'long' });
  const fmtD = d => d.slice(5).split('-').reverse().join('/');
  const periodLabel = customDateRange
    ? `${fmtD(customDateRange.from)} a ${fmtD(customDateRange.to)}`
    : period === 'month'
      ? `1 a ${now.getDate()} de ${monthName}`
      : period === 1 ? 'hoje' : `${period} dias`;
  document.getElementById('evolucao-subtitle').textContent =
    `Comparativo entre lojas — ${periodLabel}`;

  if (chartEvolucao) chartEvolucao.destroy();
  chartEvolucao = new Chart(document.getElementById('chart-evolucao'), {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      layout: { padding: { top: showLabels ? (mobile ? 32 : 24) : 8 } },
      plugins: {
        legend: {
          ...CHART_DEFAULTS.legend,
          labels: {
            ...CHART_DEFAULTS.legend.labels,
            font: { family: 'Inter', size: mobile ? 10 : 11 },
          },
        },
        tooltip: {
          ...CHART_DEFAULTS.tooltip,
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${fmtBRL(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          ...CHART_DEFAULTS.scales.x,
          ticks: {
            ...CHART_DEFAULTS.scales.x.ticks,
            font: { family: 'Inter', size: mobile ? 10 : 11 },
            maxRotation: 0,
            maxTicksLimit: mobile ? 6 : (period === 'month' ? 10 : undefined),
          },
        },
        y: {
          ...CHART_DEFAULTS.scales.y,
          ticks: {
            ...CHART_DEFAULTS.scales.y.ticks,
            font: { family: 'Inter', size: mobile ? 10 : 11 },
            maxTicksLimit: mobile ? 4 : 6,
            callback: v => 'R$ ' + (v / 1000).toFixed(1) + 'k',
          },
        },
      },
    },
  });
}

// --- Ranking horizontal por loja ---
function buildRankingHorizontal(data) {
  const storeKeys  = ['albatroz', 'point', 'tagus'];
  const storeNames = { albatroz: 'Albatroz', point: 'The Point', tagus: 'Tagus II' };

  const entries = storeKeys.map(key => ({
    key,
    name: storeNames[key],
    fat: data.filter(r => r.store === key).reduce((a, b) => a + b.fat, 0),
  }));

  entries.sort((a, b) => b.fat - a.fat);

  const total = entries.reduce((a, b) => a + b.fat, 0);
  const max   = entries[0].fat;

  const container = document.getElementById('ranking-horizontal');
  container.innerHTML = entries.map((e, i) => {
    const pct     = total > 0 ? ((e.fat / total) * 100).toFixed(1) : 0;
    const barW    = max  > 0 ? ((e.fat / max)   * 100).toFixed(1) : 0;
    const posClass = `pos-${i + 1}`;
    const barColor = COLORS[e.key].line;
    return `
      <div class="ranking-h-item">
        <div class="ranking-h-pos ${posClass}">${i + 1}</div>
        <div class="ranking-h-info">
          <div class="ranking-h-name">
            <span class="ranking-h-label">${e.name}</span>
            <span><span class="ranking-h-value">${fmtBRL(e.fat)}</span><span class="ranking-h-pct">${pct}%</span></span>
          </div>
          <div class="ranking-h-bar-wrap">
            <div class="ranking-h-bar" style="width:${barW}%; background:${barColor}"></div>
          </div>
        </div>
      </div>`;
  }).join('');

  document.getElementById('best-store').textContent  = entries[0].name;
  document.getElementById('worst-store').textContent = entries[entries.length - 1].name;
}

// --- Gráfico: ticket médio por loja ---
function buildTicket(data) {
  const storeKeys  = ['albatroz', 'point', 'tagus'];
  const storeNames = ['Albatroz', 'The Point', 'Tagus II'];

  const tkts = storeKeys.map(key => {
    const rows = data.filter(r => r.store === key);
    const fat  = rows.reduce((a, b) => a + b.fat, 0);
    const vnd  = rows.reduce((a, b) => a + b.vnd, 0);
    return vnd > 0 ? Math.round((fat / vnd) * 100) / 100 : 0;
  });

  const mobile = isMobile();

  if (chartTicket) chartTicket.destroy();
  chartTicket = new Chart(document.getElementById('chart-ticket'), {
    type: 'bar',
    data: {
      labels: storeNames,
      datasets: [{
        label: 'Ticket Médio',
        data: tkts,
        backgroundColor: storeKeys.map(k => COLORS[k].bar),
        hoverBackgroundColor: storeKeys.map(k => COLORS[k].line),
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: mobile ? 28 : 24 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...CHART_DEFAULTS.tooltip,
          callbacks: { label: ctx => ` ${fmtBRL(ctx.parsed.y)}` },
        },
        datalabels: {
          display: true,
          color: (ctx) => storeKeys.map(k => COLORS[k].line)[ctx.dataIndex],
          font: { family: 'Inter', size: mobile ? 9 : 10, weight: '700' },
          formatter: v => v > 0 ? fmtBRL(v) : '',
          anchor: 'end',
          align: 'top',
          offset: 2,
          clamp: true,
        },
      },
      scales: {
        x: {
          ...CHART_DEFAULTS.scales.x,
          ticks: {
            ...CHART_DEFAULTS.scales.x.ticks,
            font: { family: 'Inter', size: mobile ? 10 : 11 },
          },
        },
        y: {
          ...CHART_DEFAULTS.scales.y,
          ticks: {
            ...CHART_DEFAULTS.scales.y.ticks,
            font: { family: 'Inter', size: mobile ? 10 : 11 },
            maxTicksLimit: mobile ? 4 : 6,
            callback: v => 'R$' + (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v),
          },
        },
      },
    },
  });
}

// --- Insights automáticos ---
function buildInsights(data, period) {
  const storeKeys  = ['albatroz', 'point', 'tagus'];
  const storeNames = { albatroz: 'Albatroz', point: 'The Point', tagus: 'Tagus II' };

  const totals = {};
  const tkts   = {};
  storeKeys.forEach(key => {
    const rows = data.filter(r => r.store === key);
    const fat  = rows.reduce((a, b) => a + b.fat, 0);
    const vnd  = rows.reduce((a, b) => a + b.vnd, 0);
    totals[key] = fat;
    tkts[key]   = vnd > 0 ? fat / vnd : 0;
  });

  const best     = storeKeys.reduce((a, b) => totals[a] > totals[b] ? a : b);
  const worst    = storeKeys.reduce((a, b) => totals[a] < totals[b] ? a : b);
  const bestTkt  = storeKeys.reduce((a, b) => tkts[a] > tkts[b] ? a : b);
  const worstTkt = storeKeys.reduce((a, b) => tkts[a] < tkts[b] ? a : b);

  const prev     = prevData(period);
  const pointCur = data.filter(r => r.store === 'point').reduce((a, b) => a + b.fat, 0);
  const pointPrv = prev.filter(r => r.store === 'point').reduce((a, b) => a + b.fat, 0);
  const pointVar = pointPrv > 0 ? ((pointCur - pointPrv) / pointPrv) * 100 : 0;

  const avgTkt = Object.values(tkts).reduce((a, b) => a + b, 0) / 3;
  const worstTktDiff = ((tkts[worstTkt] - avgTkt) / avgTkt) * 100;

  const insights = [
    {
      type: 'positive',
      icon: '↑',
      text: `<strong>${storeNames[best]}</strong> liderou o faturamento — maior volume do período`,
      meta: `${fmtBRL(totals[best])} · ${fmtPct((totals[best] / (totals.albatroz + totals.point + totals.tagus)) * 100)} do total`,
    },
    {
      type: worstTktDiff < -10 ? 'warning' : 'neutral',
      icon: worstTktDiff < -10 ? '!' : '→',
      text: `<strong>${storeNames[worstTkt]}</strong> com menor ticket médio do período`,
      meta: `${fmtBRL(tkts[worstTkt])} por venda · ${fmtPct(worstTktDiff)} da média geral`,
    },
    {
      type: pointVar >= 0 ? 'positive' : 'warning',
      icon: pointVar >= 0 ? '↑' : '↓',
      text: `The Point Offices <strong>${pointVar >= 0 ? 'cresceu' : 'recuou'} ${fmtPct(Math.abs(pointVar))}</strong> vs período anterior`,
      meta: `${fmtBRL(pointCur)} atual · ${fmtBRL(pointPrv)} anterior`,
    },
  ];

  const container = document.getElementById('insights-container');
  container.innerHTML = insights.map(i => `
    <div class="insight-item insight-${i.type}">
      <div class="insight-badge">${i.icon}</div>
      <div class="insight-body">
        <p>${i.text}</p>
        <span class="insight-meta">${i.meta}</span>
      </div>
    </div>
  `).join('');
}

// --- Tabela ---
function buildTable(data) {
  const tbody = document.getElementById('sales-tbody');
  const storeColors = {
    albatroz: 'var(--color-albatroz)',
    point:    'var(--color-point)',
    tagus:    'var(--color-tagus)',
  };

  const sorted = [...data].sort((a, b) => b.date.localeCompare(a.date));

  tbody.innerHTML = sorted.map(r => `
    <tr>
      <td class="td-date">${r.label}</td>
      <td>
        <span class="store-chip">
          <span class="store-chip-dot" style="background:${storeColors[r.store]}"></span>
          ${r.name}
        </span>
      </td>
      <td class="align-right">${fmtBRL(r.fat)}</td>
      <td class="align-right">${r.vnd}</td>
      <td class="align-right">${fmtBRL(r.tkt)}</td>
    </tr>
  `).join('');

  document.getElementById('table-count').textContent = `${sorted.length} registros`;
}

// --- Render completo ---
function render() {
  const data    = filterData(currentPeriod, currentStore);
  const allData = filterData(currentPeriod, 'all');
  updateKPIs(data, currentPeriod);
  buildEvolucao(data, currentPeriod);
  buildRankingHorizontal(allData);
  buildTicket(allData);
  buildInsights(allData, currentPeriod);
  buildTable(data);
}

// --- Data no header ---
function setCurrentDate() {
  const el = document.getElementById('page-date');
  if (!el) return;
  const opts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  el.textContent = new Date().toLocaleDateString('pt-BR', opts);
}

// --- Event listeners ---
function initFilters() {
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const p = btn.dataset.period;
      currentPeriod   = p === 'month' ? 'month' : (parseInt(p) || 7);
      customDateRange = null;
      const drLabel = document.getElementById('date-range-label');
      const drBtn   = document.getElementById('date-range-btn');
      if (drLabel) drLabel.textContent = 'Personalizado';
      if (drBtn)   drBtn.classList.remove('active');
      render();
    });
  });

  document.querySelectorAll('.store-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.store-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentStore = btn.dataset.store;
      render();
    });
  });

  document.querySelector('.refresh-btn')?.addEventListener('click', render);
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
    customDateRange = { from, to };
    currentPeriod   = 'custom';
    render();
  });

  clearBtn.addEventListener('click', () => {
    fromInput.value = '';
    toInput.value   = '';
    label.textContent = 'Personalizado';
    btn.classList.remove('active');
    popover.classList.remove('open');
    customDateRange = null;
    currentPeriod   = 7;
    const sevenBtn = document.querySelector('.period-btn[data-period="7"]');
    if (sevenBtn) sevenBtn.classList.add('active');
    render();
  });
}

// --- Carrega dados reais e inicializa ---
async function loadData() {
  try {
    const res = await fetch('data/history.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('history.json não encontrado');
    const history = await res.json();
    ALL_RECORDS = history.records || [];
    ALL_DATES   = history.dates   || [];
  } catch (err) {
    console.warn('[vendas] Erro ao carregar dados reais, usando mock:', err.message);
    // fallback para mock se o arquivo não existir
    ALL_RECORDS = generateData(30);
    ALL_DATES   = [...new Set(ALL_RECORDS.map(r => r.date))].sort();
  }
}

// --- INIT ---
document.addEventListener('DOMContentLoaded', async () => {
  setCurrentDate();
  initMobileMenu();
  initFilters();
  initDateRangePicker();
  await loadData();
  render();
});
