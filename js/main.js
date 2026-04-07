// ============================================
// DASHBOARD UNIFICADO — Minha Quitandinha
// ============================================

function isMobile() { return window.innerWidth < 768; }
function fmtK(v) { return v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(v); }
function sum(arr, key) { return arr.reduce((acc, item) => acc + (item[key] || 0), 0); }

function fmtBRL(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtPct(v) {
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(1)}%`;
}

function fmtShortDate(iso) {
  return iso ? iso.slice(5).split('-').reverse().join('/') : '—';
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function toIso(date) {
  return date.toISOString().split('T')[0];
}

const COLORS = {
  albatroz: { line: '#4f7cff', bar: 'rgba(79,124,255,0.8)', bg: 'rgba(79,124,255,0.1)' },
  point: { line: '#22d37a', bar: 'rgba(34,211,122,0.8)', bg: 'rgba(34,211,122,0.08)' },
  tagus: { line: '#f5c842', bar: 'rgba(245,200,66,0.8)', bg: 'rgba(245,200,66,0.07)' },
};

const STORE_NAMES = {
  albatroz: 'Albatroz',
  point: 'The Point',
  tagus: 'Tagus II',
};

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
      boxWidth: 10,
      boxHeight: 10,
      borderRadius: 2,
      padding: 16,
      usePointStyle: true,
      pointStyle: 'circle',
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

if (typeof ChartDataLabels !== 'undefined') {
  Chart.register(ChartDataLabels);
}

let ALL_RECORDS = [];
let ALL_DATES = [];
let currentPeriod = 'today';
let currentStore = 'all';
let customDateRange = null;

let chartEvolucao = null;
let chartCount = null;
let chartTicket = null;

function latestReferenceDate() {
  const latest = ALL_DATES[ALL_DATES.length - 1];
  return latest ? new Date(`${latest}T12:00:00`) : new Date();
}

function closedMonthDates() {
  const ref = latestReferenceDate();
  const closedMonth = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
  const from = toIso(startOfMonth(closedMonth));
  const to = toIso(endOfMonth(closedMonth));
  return ALL_DATES.filter(d => d >= from && d <= to);
}

function prevClosedMonthDates() {
  const ref = latestReferenceDate();
  const month = new Date(ref.getFullYear(), ref.getMonth() - 2, 1);
  const from = toIso(startOfMonth(month));
  const to = toIso(endOfMonth(month));
  return ALL_DATES.filter(d => d >= from && d <= to);
}

function getSelectedDates() {
  if (customDateRange) {
    return ALL_DATES.filter(d => d >= customDateRange.from && d <= customDateRange.to);
  }
  if (currentPeriod === 'today') {
    return ALL_DATES.length ? [ALL_DATES[ALL_DATES.length - 1]] : [];
  }
  if (currentPeriod === 'closed-month') {
    return closedMonthDates();
  }
  return ALL_DATES.slice(-parseInt(currentPeriod, 10));
}

function getPreviousDates() {
  if (customDateRange) {
    const span = Math.round((new Date(customDateRange.to) - new Date(customDateRange.from)) / 86400000) + 1;
    const prevTo = new Date(`${customDateRange.from}T12:00:00`);
    prevTo.setDate(prevTo.getDate() - 1);
    const prevFrom = new Date(prevTo);
    prevFrom.setDate(prevFrom.getDate() - span + 1);
    return ALL_DATES.filter(d => d >= toIso(prevFrom) && d <= toIso(prevTo));
  }
  if (currentPeriod === 'today') {
    return ALL_DATES.length > 1 ? [ALL_DATES[ALL_DATES.length - 2]] : [];
  }
  if (currentPeriod === 'closed-month') {
    return prevClosedMonthDates();
  }
  const size = parseInt(currentPeriod, 10);
  const end = ALL_DATES.length - size;
  const start = Math.max(0, end - size);
  return ALL_DATES.slice(start, end);
}

function filterRecords(dates, store = currentStore) {
  return ALL_RECORDS.filter(record =>
    dates.includes(record.date) && (store === 'all' || record.store === store)
  );
}

function aggregateByStore(data) {
  const stores = ['albatroz', 'point', 'tagus'].map(key => {
    const rows = data.filter(item => item.store === key);
    const fat = sum(rows, 'fat');
    const vnd = sum(rows, 'vnd');
    return {
      key,
      name: rows[0]?.name || STORE_NAMES[key],
      fat,
      vnd,
      tkt: vnd > 0 ? fat / vnd : 0,
    };
  }).sort((a, b) => b.fat - a.fat);

  const fat = sum(stores, 'fat');
  const vnd = sum(stores, 'vnd');

  return {
    summary: { fat, vnd, tkt: vnd > 0 ? fat / vnd : 0 },
    stores,
  };
}

function getPeriodLabel() {
  if (customDateRange) {
    return `${fmtShortDate(customDateRange.from)} a ${fmtShortDate(customDateRange.to)}`;
  }
  if (currentPeriod === 'today') return 'Hoje';
  if (currentPeriod === 'closed-month') {
    const dates = getSelectedDates();
    if (!dates.length) return 'Mês anterior';
    const ref = new Date(`${dates[0]}T12:00:00`);
    return `Mês anterior • ${ref.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`;
  }
  return `Últimos ${currentPeriod} dias`;
}

function getStoreLabel() {
  if (currentStore === 'all') return 'Todas as lojas';
  return STORE_NAMES[currentStore] || currentStore;
}

function updateHero(syncText) {
  const periodEl = document.getElementById('hero-period');
  const storeEl = document.getElementById('hero-store');
  const syncEl = document.getElementById('hero-sync');
  if (periodEl) periodEl.textContent = getPeriodLabel();
  if (storeEl) storeEl.textContent = getStoreLabel();
  if (syncEl && syncText) syncEl.textContent = syncText;
}

function updateKPILabels() {
  const today = currentPeriod === 'today' && !customDateRange;
  const fatLabel = document.getElementById('kpi-fat-label');
  const vndLabel = document.getElementById('kpi-vnd-label');
  const tktLabel = document.getElementById('kpi-tkt-label');
  if (fatLabel) fatLabel.textContent = today ? 'Faturamento do Dia' : 'Faturamento do Período';
  if (vndLabel) vndLabel.textContent = today ? 'Vendas Aprovadas' : 'Total de Vendas';
  if (tktLabel) tktLabel.textContent = today ? 'Ticket Médio' : 'Ticket Médio Geral';
}

function updateKPIs(currentData, previousData) {
  updateKPILabels();

  const fat = sum(currentData, 'fat');
  const vnd = sum(currentData, 'vnd');
  const tkt = vnd > 0 ? fat / vnd : 0;

  const fatPrev = sum(previousData, 'fat');
  const vndPrev = sum(previousData, 'vnd');
  const tktPrev = vndPrev > 0 ? fatPrev / vndPrev : 0;
  const varPct = fatPrev > 0 ? ((fat - fatPrev) / fatPrev) * 100 : 0;

  document.getElementById('kpi-faturamento').textContent = fmtBRL(fat);
  document.getElementById('kpi-vendas').textContent = vnd.toLocaleString('pt-BR');
  document.getElementById('kpi-ticket').textContent = fmtBRL(tkt);
  document.getElementById('kpi-variacao').textContent = fmtPct(varPct);

  setDelta('kpi-fat-delta', fat, fatPrev, currentPeriod === 'today' && !customDateRange ? 'vs ontem' : 'vs período anterior', fmtPct);
  setDelta('kpi-vnd-delta', vnd, vndPrev, currentPeriod === 'today' && !customDateRange ? 'vs ontem' : 'vs período anterior', fmtPct);
  setDelta('kpi-tkt-delta', tkt, tktPrev, currentPeriod === 'today' && !customDateRange ? 'vs ontem' : 'vs período anterior', fmtPct);

  const variationEl = document.getElementById('kpi-variacao');
  variationEl.className = `kpi-value ${varPct < 0 ? 'negative-val' : ''}`;
  variationEl.style.color = varPct >= 0 ? 'var(--green)' : 'var(--red)';

  const previousDates = getPreviousDates();
  const deltaLabel = document.getElementById('kpi-var-delta');
  if (deltaLabel) {
    let text = 'sem histórico';
    if (previousDates.length === 1) {
      text = fmtShortDate(previousDates[0]);
    } else if (previousDates.length > 1) {
      text = `${fmtShortDate(previousDates[0])} – ${fmtShortDate(previousDates[previousDates.length - 1])}`;
    }
    deltaLabel.innerHTML = `<span>${text}</span>`;
  }
}

function setDelta(elementId, currentValue, previousValue, suffix, formatter) {
  const element = document.getElementById(elementId);
  if (!element) return;
  const span = element.querySelector('span');

  if (previousValue <= 0) {
    element.className = 'kpi-delta neutral';
    if (span) span.textContent = 'sem histórico';
    return;
  }

  const delta = ((currentValue - previousValue) / previousValue) * 100;
  element.className = `kpi-delta ${delta >= 0 ? 'positive' : 'negative'}`;
  if (span) span.textContent = `${formatter(delta)} ${suffix}`;
}

function buildTodayView(data) {
  const todayView = document.getElementById('today-stores-view');
  const canvas = document.getElementById('chart-evolucao');
  const chartContainer = canvas?.closest('.chart-container');
  if (!todayView || !canvas) return;

  if (chartEvolucao) {
    chartEvolucao.destroy();
    chartEvolucao = null;
  }

  canvas.style.display = 'none';
  todayView.classList.add('active');
  if (chartContainer) chartContainer.classList.add('today-mode');

  const keys = currentStore === 'all' ? ['albatroz', 'point', 'tagus'] : [currentStore];
  todayView.innerHTML = keys.map(key => {
    const rows = data.filter(item => item.store === key);
    const fat = sum(rows, 'fat');
    const vnd = sum(rows, 'vnd');
    const tkt = vnd > 0 ? fat / vnd : 0;
    return `
      <div class="today-store-card" style="--card-accent:${COLORS[key].line}">
        <div class="today-store-name">${STORE_NAMES[key]}</div>
        <div class="today-store-fat">${fmtBRL(fat)}</div>
        <div class="today-store-meta">
          <div class="today-store-meta-row">
            <span class="today-store-meta-label">Vendas aprovadas</span>
            <span class="today-store-meta-value">${vnd}</span>
          </div>
          <div class="today-store-meta-row">
            <span class="today-store-meta-label">Ticket médio</span>
            <span class="today-store-meta-value">${fmtBRL(tkt)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('evolucao-subtitle').textContent = 'Snapshot por loja — hoje';
}

function buildEvolucao(data, dates) {
  const todayView = document.getElementById('today-stores-view');
  const canvas = document.getElementById('chart-evolucao');
  const chartContainer = canvas?.closest('.chart-container');
  if (!canvas) return;

  const isToday = currentPeriod === 'today' && !customDateRange;
  if (isToday) {
    buildTodayView(data);
    return;
  }

  if (todayView) todayView.classList.remove('active');
  canvas.style.display = 'block';
  if (chartContainer) chartContainer.classList.remove('today-mode');

  const labels = dates.map(d => {
    const row = ALL_RECORDS.find(item => item.date === d);
    return row ? row.label : fmtShortDate(d);
  });

  const storeKeys = currentStore === 'all' ? ['albatroz', 'point', 'tagus'] : [currentStore];
  const mobile = isMobile();
  const showLabels = customDateRange ? dates.length <= 7 : currentPeriod !== 'closed-month' && dates.length <= 7;

  const datasets = storeKeys.map(key => ({
    label: STORE_NAMES[key],
    data: dates.map(d => {
      const row = data.find(item => item.date === d && item.store === key);
      return row ? row.fat : null;
    }),
    borderColor: COLORS[key].line,
    backgroundColor: COLORS[key].bg,
    borderWidth: 2,
    pointRadius: mobile ? 2 : (dates.length <= 7 ? 4 : 2),
    pointHoverRadius: 6,
    tension: 0.4,
    fill: true,
    spanGaps: true,
    datalabels: {
      display: ctx => {
        if (!showLabels) return false;
        if (mobile) return ctx.dataIndex === 0 || ctx.dataIndex === labels.length - 1;
        return true;
      },
      color: COLORS[key].line,
      font: { family: 'Inter', size: mobile ? 9 : 10, weight: '700' },
      formatter: value => value != null ? fmtK(value) : '',
      anchor: 'end',
      align: 'top',
      offset: 2,
      clamp: true,
    },
  }));

  if (currentStore === 'all') {
    datasets.push({
      label: 'Total',
      data: dates.map(d => {
        const total = Math.round(filterRecords([d], 'all').reduce((acc, item) => acc + item.fat, 0) * 100) / 100;
        return total > 0 ? total : null;
      }),
      borderColor: 'rgba(255,255,255,0.45)',
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderDash: [5, 4],
      pointRadius: 0,
      pointHoverRadius: 5,
      pointHoverBackgroundColor: 'rgba(255,255,255,0.7)',
      tension: 0.4,
      fill: false,
      spanGaps: true,
      order: 0,
      datalabels: {
        display: ctx => {
          if (!showLabels) return false;
          if (mobile) return ctx.dataIndex === labels.length - 1;
          return true;
        },
        color: 'rgba(255,255,255,0.6)',
        font: { family: 'Inter', size: mobile ? 9 : 10, weight: '700' },
        formatter: value => value != null ? fmtK(value) : '',
        anchor: 'end',
        align: 'top',
        offset: 2,
        clamp: true,
      },
    });
  }

  document.getElementById('evolucao-subtitle').textContent = `Comparativo entre lojas — ${getPeriodLabel().toLowerCase()}`;

  if (chartEvolucao) chartEvolucao.destroy();
  chartEvolucao = new Chart(canvas, {
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
            maxTicksLimit: mobile ? 6 : (dates.length > 15 ? 10 : undefined),
          },
        },
        y: {
          ...CHART_DEFAULTS.scales.y,
          ticks: {
            ...CHART_DEFAULTS.scales.y.ticks,
            font: { family: 'Inter', size: mobile ? 10 : 11 },
            maxTicksLimit: mobile ? 4 : 6,
            callback: value => `R$ ${(Number(value) / 1000).toFixed(1)}k`,
          },
        },
      },
    },
  });
}

function buildCountChart(data, dates) {
  const canvas = document.getElementById('chart-count');
  if (!canvas) return;

  const storeKeys = currentStore === 'all' ? ['albatroz', 'point', 'tagus'] : [currentStore];
  const mobile = isMobile();

  const labels = dates.map(d => fmtShortDate(d));
  const datasets = storeKeys.map(key => ({
    label: STORE_NAMES[key],
    data: dates.map(d => {
      const row = data.find(item => item.date === d && item.store === key);
      return row ? row.vnd : 0;
    }),
    backgroundColor: COLORS[key].bar,
    hoverBackgroundColor: COLORS[key].line,
    borderRadius: currentPeriod === 'today' && !customDateRange ? 6 : 3,
    borderSkipped: false,
    stack: 'vendas',
    datalabels: {
      display: valueCtx => {
        const value = valueCtx.dataset.data[valueCtx.dataIndex];
        if (!value) return false;
        if (mobile) return dates.length <= 7;
        return true;
      },
      color: '#090b0f',
      font: { family: 'Inter', size: mobile ? 8 : 9, weight: '700' },
      formatter: value => value > 0 ? String(value) : '',
      anchor: 'center',
      align: 'center',
      offset: 0,
      clamp: true,
      clip: true,
    },
  }));

  const subtitle = document.getElementById('count-subtitle');
  if (subtitle) subtitle.textContent = `Por loja — ${getPeriodLabel().toLowerCase()}`;

  if (chartCount) chartCount.destroy();
  chartCount = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
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
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y} vendas`,
            footer: items => `Total: ${items.reduce((acc, item) => acc + item.parsed.y, 0)} vendas`,
          },
        },
        datalabels: {},
      },
      scales: {
        x: {
          ...CHART_DEFAULTS.scales.x,
          stacked: true,
          ticks: {
            ...CHART_DEFAULTS.scales.x.ticks,
            font: { family: 'Inter', size: mobile ? 10 : 11 },
            maxRotation: 0,
            maxTicksLimit: mobile ? 6 : (dates.length > 15 ? 10 : undefined),
          },
        },
        y: {
          ...CHART_DEFAULTS.scales.y,
          stacked: true,
          ticks: {
            ...CHART_DEFAULTS.scales.y.ticks,
            font: { family: 'Inter', size: mobile ? 10 : 11 },
            maxTicksLimit: mobile ? 4 : 6,
            precision: 0,
          },
        },
      },
    },
  });
}

function buildRankingHorizontal(data) {
  const entries = ['albatroz', 'point', 'tagus'].map(key => ({
    key,
    name: STORE_NAMES[key],
    fat: sum(data.filter(item => item.store === key), 'fat'),
  })).sort((a, b) => b.fat - a.fat);

  const total = sum(entries, 'fat');
  const max = entries[0]?.fat || 0;

  const container = document.getElementById('ranking-horizontal');
  if (!container) return;

  container.innerHTML = entries.map((entry, index) => {
    const pct = total > 0 ? ((entry.fat / total) * 100).toFixed(1) : 0;
    const barWidth = max > 0 ? ((entry.fat / max) * 100).toFixed(1) : 0;
    return `
      <div class="ranking-h-item">
        <div class="ranking-h-pos pos-${index + 1}">${index + 1}</div>
        <div class="ranking-h-info">
          <div class="ranking-h-name">
            <span class="ranking-h-label">${entry.name}</span>
            <span><span class="ranking-h-value">${fmtBRL(entry.fat)}</span><span class="ranking-h-pct">${pct}%</span></span>
          </div>
          <div class="ranking-h-bar-wrap">
            <div class="ranking-h-bar" style="width:${barWidth}%; background:${COLORS[entry.key].line}"></div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('best-store').textContent = entries[0]?.name || '—';
  document.getElementById('worst-store').textContent = entries[entries.length - 1]?.name || '—';
}

function buildTicketChart(data) {
  const keys = ['albatroz', 'point', 'tagus'];
  const ticketValues = keys.map(key => {
    const rows = data.filter(item => item.store === key);
    const fat = sum(rows, 'fat');
    const vnd = sum(rows, 'vnd');
    return vnd > 0 ? Math.round((fat / vnd) * 100) / 100 : 0;
  });

  const mobile = isMobile();
  const mobileFormatter = value => {
    if (value >= 1000) return `R$${(value / 1000).toFixed(1)}k`;
    return `R$${Math.round(value)}`;
  };
  if (chartTicket) chartTicket.destroy();

  chartTicket = new Chart(document.getElementById('chart-ticket'), {
    type: 'bar',
    data: {
      labels: keys.map(key => STORE_NAMES[key]),
      datasets: [{
        label: 'Ticket Médio',
        data: ticketValues,
        backgroundColor: keys.map(key => COLORS[key].bar),
        hoverBackgroundColor: keys.map(key => COLORS[key].line),
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: mobile ? 22 : 24, right: mobile ? 10 : 0, left: mobile ? 2 : 0 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...CHART_DEFAULTS.tooltip,
          callbacks: { label: ctx => ` ${fmtBRL(ctx.parsed.y)}` },
        },
        datalabels: {
          display: true,
          color: ctx => COLORS[keys[ctx.dataIndex]].line,
          font: { family: 'Inter', size: mobile ? 8 : 10, weight: '700' },
          formatter: value => value > 0 ? (mobile ? mobileFormatter(value) : fmtBRL(value)) : '',
          anchor: 'end',
          align: 'top',
          offset: 2,
          clamp: true,
          clip: true,
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
            callback: value => `R$${value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value}`,
          },
        },
      },
    },
  });
}

function buildInsights(allData, previousAllData) {
  const keys = ['albatroz', 'point', 'tagus'];
  const totals = {};
  const tkts = {};

  keys.forEach(key => {
    const rows = allData.filter(item => item.store === key);
    const fat = sum(rows, 'fat');
    const vnd = sum(rows, 'vnd');
    totals[key] = fat;
    tkts[key] = vnd > 0 ? fat / vnd : 0;
  });

  const best = keys.reduce((acc, key) => totals[key] > totals[acc] ? key : acc, keys[0]);
  const worst = keys.reduce((acc, key) => totals[key] < totals[acc] ? key : acc, keys[0]);
  const bestTkt = keys.reduce((acc, key) => tkts[key] > tkts[acc] ? key : acc, keys[0]);
  const worstTkt = keys.reduce((acc, key) => tkts[key] < tkts[acc] ? key : acc, keys[0]);

  const prevTotal = sum(previousAllData, 'fat');
  const currentTotal = sum(allData, 'fat');
  const currentVariation = prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : 0;

  const avgTkt = Object.values(tkts).reduce((acc, value) => acc + value, 0) / keys.length;
  const worstGap = avgTkt > 0 ? ((tkts[worstTkt] - avgTkt) / avgTkt) * 100 : 0;

  const insights = [
    {
      type: 'positive',
      icon: '1',
      text: `<strong>${STORE_NAMES[best]}</strong> lidera o faturamento do período selecionado.`,
      meta: `${fmtBRL(totals[best])} acumulados`,
    },
    {
      type: currentVariation >= 0 ? 'positive' : 'warning',
      icon: currentVariation >= 0 ? '↑' : '↓',
      text: `Resultado ${currentVariation >= 0 ? 'acima' : 'abaixo'} do período anterior em <strong>${fmtPct(Math.abs(currentVariation))}</strong>.`,
      meta: `${fmtBRL(currentTotal)} atual · ${fmtBRL(prevTotal)} anterior`,
    },
    {
      type: worstGap < -10 ? 'warning' : 'neutral',
      icon: 'T',
      text: `<strong>${STORE_NAMES[bestTkt]}</strong> tem o melhor ticket médio, enquanto ${STORE_NAMES[worstTkt]} pede atenção.`,
      meta: `${fmtBRL(tkts[bestTkt])} melhor ticket · ${fmtPct(worstGap)} vs média em ${STORE_NAMES[worstTkt]}`,
    },
  ];

  const container = document.getElementById('insights-container');
  if (!container) return;

  container.innerHTML = insights.map(item => `
    <div class="insight-item insight-${item.type}">
      <div class="insight-badge">${item.icon}</div>
      <div class="insight-body">
        <p>${item.text}</p>
        <span class="insight-meta">${item.meta}</span>
      </div>
    </div>
  `).join('');
}

function buildTable(data) {
  const tbody = document.getElementById('sales-tbody');
  if (!tbody) return;

  const storeColors = {
    albatroz: 'var(--color-albatroz)',
    point: 'var(--color-point)',
    tagus: 'var(--color-tagus)',
  };

  const sorted = [...data].sort((a, b) => b.date.localeCompare(a.date) || b.fat - a.fat);
  tbody.innerHTML = sorted.map(row => `
    <tr>
      <td class="td-date">${row.label}</td>
      <td>
        <span class="store-chip">
          <span class="store-chip-dot" style="background:${storeColors[row.store]}"></span>
          ${row.name}
        </span>
      </td>
      <td class="align-right">${fmtBRL(row.fat)}</td>
      <td class="align-right">${row.vnd}</td>
      <td class="align-right">${fmtBRL(row.tkt)}</td>
    </tr>
  `).join('');

  const count = document.getElementById('table-count');
  if (count) count.textContent = `${sorted.length} registros`;
}

function render() {
  const dates = getSelectedDates();
  const previousDates = getPreviousDates();

  const currentData = filterRecords(dates, currentStore);
  const previousData = filterRecords(previousDates, currentStore);
  const allData = filterRecords(dates, 'all');
  const previousAllData = filterRecords(previousDates, 'all');

  updateHero();
  updateKPIs(currentData, previousData);
  buildEvolucao(currentData, dates);
  buildCountChart(currentData, dates);
  buildRankingHorizontal(allData);
  buildTicketChart(allData);
  buildInsights(allData, previousAllData);
  buildTable(currentData);
}

function setLastSync(isoTimestamp) {
  if (!isoTimestamp) return;
  const date = new Date(isoTimestamp);
  date.setTime(date.getTime() - 3 * 60 * 60 * 1000);
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const mon = String(date.getUTCMonth() + 1).padStart(2, '0');
  const text = `Atualizado ${day}/${mon} às ${hh}:${mm}`;

  const ids = ['last-sync-label', 'hero-sync'];
  ids.forEach(id => {
    const element = document.getElementById(id);
    if (element) element.textContent = text;
  });
}

async function loadData() {
  try {
    const stamp = Date.now();
    const [historyRes, salesRes] = await Promise.all([
      fetch(`data/history.json?t=${stamp}`),
      fetch(`data/sales.json?t=${stamp}`),
    ]);

    if (!historyRes.ok) throw new Error('history.json não encontrado');

    const history = await historyRes.json();
    ALL_RECORDS = history.records || [];
    ALL_DATES = history.dates || [];

    if (salesRes.ok) {
      const sales = await salesRes.json();
      setLastSync(sales.generatedAt);
    }
  } catch (error) {
    console.error('[dashboard] erro ao carregar dados', error);
  }
}

function resetCustomRange() {
  customDateRange = null;
  const label = document.getElementById('date-range-label');
  const button = document.getElementById('date-range-btn');
  if (label) label.textContent = 'Personalizado';
  if (button) button.classList.remove('active');
}

function initFilters() {
  document.querySelectorAll('.period-btn').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.period-btn').forEach(item => item.classList.remove('active'));
      button.classList.add('active');
      currentPeriod = button.dataset.period;
      resetCustomRange();
      render();
    });
  });

  document.querySelectorAll('.store-btn').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.store-btn').forEach(item => item.classList.remove('active'));
      button.classList.add('active');
      currentStore = button.dataset.store;
      render();
    });
  });

  document.querySelectorAll('.refresh-btn').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.refresh-btn').forEach(item => item.classList.add('spinning'));
      loadData().then(render).finally(() => {
        setTimeout(() => {
          document.querySelectorAll('.refresh-btn').forEach(item => item.classList.remove('spinning'));
        }, 400);
      });
    });
  });
}

function initDateRangePicker() {
  const button = document.getElementById('date-range-btn');
  const popover = document.getElementById('date-range-popover');
  const fromInput = document.getElementById('date-from');
  const toInput = document.getElementById('date-to');
  const applyButton = document.getElementById('date-range-apply');
  const clearButton = document.getElementById('date-range-clear');
  const label = document.getElementById('date-range-label');

  if (!button || !popover || !fromInput || !toInput || !applyButton || !clearButton || !label) return;

  button.addEventListener('click', event => {
    event.stopPropagation();
    popover.classList.toggle('open');
  });

  document.addEventListener('click', () => popover.classList.remove('open'));
  popover.addEventListener('click', event => event.stopPropagation());

  applyButton.addEventListener('click', () => {
    const from = fromInput.value;
    const to = toInput.value;
    if (!from || !to || from > to) return;

    label.textContent = `${fmtShortDate(from)} — ${fmtShortDate(to)}`;
    button.classList.add('active');
    popover.classList.remove('open');
    document.querySelectorAll('.period-btn').forEach(item => item.classList.remove('active'));
    customDateRange = { from, to };
    currentPeriod = 'custom';
    render();
  });

  clearButton.addEventListener('click', () => {
    fromInput.value = '';
    toInput.value = '';
    resetCustomRange();
    popover.classList.remove('open');
    currentPeriod = 'today';
    const todayButton = document.querySelector('.period-btn[data-period="today"]');
    if (todayButton) todayButton.classList.add('active');
    render();
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  initFilters();
  initDateRangePicker();
  render();
});
