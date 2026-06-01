// ============================================
// FINANÇAS — Minha Quitandinha
// ============================================

const FIN_COLORS = {
  albatroz: '#4f7cff',
  tagus:    '#f0be3c',
  point:    '#1fd47a',
};

let finData = null;
let selectedId = null;
let chartHist = null;
let chartSemanal = null;
let chartDow = null;

function fmtBRL(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function fmtBRLDec(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtPct(v) {
  if (v === null || v === undefined) return '—';
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(1)}%`;
}

// ── Chart.js defaults ─────────────────────────────────────────────────────────

const GC = 'rgba(255,255,255,0.06)';
const TC = 'rgba(255,255,255,0.4)';

const TOOLTIP_BASE = {
  backgroundColor: '#141820',
  borderColor: 'rgba(255,255,255,0.1)',
  borderWidth: 1,
  titleColor: '#eef0f6',
  bodyColor: 'rgba(238,240,246,0.7)',
  padding: 10,
  cornerRadius: 6,
  titleFont: { family: 'Inter, sans-serif', size: 11 },
  bodyFont:  { family: 'Inter, sans-serif', size: 11 },
};

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function loadData() {
  try {
    const res = await fetch(`data/financas.json?t=${Date.now()}`);
    finData = await res.json();
    selectedId = finData.months[finData.months.length - 1].id;
    init();
  } catch (e) {
    document.getElementById('fin-kpis').innerHTML = '<p style="padding:20px;color:var(--text-muted)">Erro ao carregar dados financeiros.</p>';
  }
}

function init() {
  renderUpdated();
  renderAcumulado();
  renderMonthTabs();
  renderHistoricalChart();
  renderMonth(selectedId);
}

// ── Atualizado ────────────────────────────────────────────────────────────────

function renderUpdated() {
  const el = document.getElementById('financas-updated');
  if (!el) return;
  const d = finData.updated;
  const [y, m, day] = d.split('-');
  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  el.textContent = `Dados financeiros · atualizado em ${day}/${months[parseInt(m)-1]} ${y}`;
}

// ── Acumulado ─────────────────────────────────────────────────────────────────

function renderAcumulado() {
  const { acumulado, months } = finData;
  const totalReceita = months.reduce((s, m) => s + (m.kpis.receita || 0), 0);
  const melhorMes = [...months].sort((a, b) => (b.kpis.resultado || 0) - (a.kpis.resultado || 0))[0];
  const margemMedia = months.filter(m => m.kpis.margemOnii).map(m => m.kpis.margemOnii);
  const avgMargem = margemMedia.length ? (margemMedia.reduce((s, v) => s + v, 0) / margemMedia.length) : null;

  const cards = [
    {
      label: 'Receita Acumulada',
      value: fmtBRL(totalReceita),
      sub: acumulado.periodo,
      cls: '',
    },
    {
      label: 'Resultado Acumulado',
      value: fmtBRL(acumulado.resultado),
      sub: 'Resultado DRE Jan–Mai',
      cls: acumulado.resultado >= 0 ? 'pos' : 'neg',
    },
    {
      label: 'Margem Bruta Média',
      value: avgMargem ? `${avgMargem.toFixed(1)}%` : '—',
      sub: 'Mar–Mai · custo real Onii',
      cls: '',
    },
    {
      label: 'Melhor Resultado',
      value: melhorMes ? `${fmtBRL(melhorMes.kpis.resultado)}` : '—',
      sub: melhorMes ? `${melhorMes.label} 2026` : '—',
      cls: 'pos',
    },
  ];

  document.getElementById('fin-acumulado').innerHTML = cards.map(c => `
    <div class="fin-acum-card">
      <div class="fin-acum-label">${c.label}</div>
      <div class="fin-acum-value ${c.cls}">${c.value}</div>
      <div class="fin-acum-sub">${c.sub}</div>
    </div>
  `).join('');
}

// ── Month tabs ────────────────────────────────────────────────────────────────

function renderMonthTabs() {
  const container = document.getElementById('fin-month-tabs');
  container.innerHTML = finData.months.map(m => `
    <button class="fin-month-tab${m.id === selectedId ? ' active' : ''}"
            data-id="${m.id}"
            role="tab"
            aria-selected="${m.id === selectedId}">
      ${m.shortLabel}
    </button>
  `).join('');

  container.querySelectorAll('.fin-month-tab').forEach(btn => {
    btn.addEventListener('click', () => selectMonth(btn.dataset.id));
  });
}

function selectMonth(id) {
  selectedId = id;
  document.querySelectorAll('.fin-month-tab').forEach(btn => {
    const active = btn.dataset.id === id;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active);
  });
  renderMonth(id);
}

// ── Render month ──────────────────────────────────────────────────────────────

function renderMonth(id) {
  const month = finData.months.find(m => m.id === id);
  if (!month) return;

  renderReportLink(month);
  renderKPIs(month);
  renderStoreCards(month);
  renderDRE(month);
  renderSerie(month);
  renderAlerts(month);
  renderTop15(month);
  renderNext(month);
  renderMonthCharts(month);
}

// ── Report link ───────────────────────────────────────────────────────────────

function renderReportLink(month) {
  const link = document.getElementById('fin-report-link');
  if (month.report) {
    link.href = month.report;
    link.style.display = 'inline-flex';
    link.title = `Abrir relatório de ${month.label} 2026`;
  } else {
    link.style.display = 'none';
  }
}

// ── KPIs ──────────────────────────────────────────────────────────────────────

function renderKPIs(month) {
  const k = month.kpis;
  const res = k.resultado;
  const resCls = res > 0 ? 'kpi-sales' : res < 0 ? 'kpi-alert' : '';
  const resDelta = res > 0
    ? `<div class="kpi-delta positive"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="11" height="11"><polyline points="18 15 12 9 6 15"/></svg><span>positivo</span></div>`
    : res < 0
    ? `<div class="kpi-delta negative"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="11" height="11"><polyline points="18 15 12 9 6 15"/></svg><span>negativo</span></div>`
    : `<div class="kpi-delta neutral"><span>neutro</span></div>`;

  const hlVal = k.highlight.value !== null ? fmtBRL(k.highlight.value) : k.highlight.label;

  document.getElementById('fin-kpis').innerHTML = `
    <div class="kpi-card kpi-revenue">
      <div class="kpi-top">
        <span class="kpi-label">Receita de Vendas</span>
        <div class="kpi-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
      </div>
      <div class="kpi-value">${fmtBRL(k.receita)}</div>
      <div class="kpi-delta neutral"><span>${month.label} 2026</span></div>
    </div>

    <div class="kpi-card kpi-sales">
      <div class="kpi-top">
        <span class="kpi-label">Margem Bruta (Onii)</span>
        <div class="kpi-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg></div>
      </div>
      <div class="kpi-value">${k.margemOnii ? k.margemOnii.toFixed(1) + '%' : k.lbDRE ? fmtBRL(k.lbDRE) : '—'}</div>
      <div class="kpi-delta neutral"><span>${k.lbOnii ? fmtBRL(k.lbOnii) + ' lucro bruto' : 'CMV real Onii'}</span></div>
    </div>

    <div class="kpi-card ${resCls}">
      <div class="kpi-top">
        <span class="kpi-label">Resultado (DRE)</span>
        <div class="kpi-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg></div>
      </div>
      <div class="kpi-value${res < 0 ? ' negative-val' : ''}${res > 0 ? ' ' : ''}">${res >= 0 ? '+' : ''}${fmtBRL(res)}</div>
      ${resDelta}
    </div>

    <div class="kpi-card">
      <div class="kpi-top">
        <span class="kpi-label">${k.highlight.label}</span>
        <div class="kpi-icon" style="background:rgba(200,240,100,0.12)"><svg viewBox="0 0 24 24" fill="none" stroke="#c8f064" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div>
      </div>
      <div class="kpi-value" style="${k.highlight.value !== null ? 'color:var(--accent)' : ''}">${hlVal}</div>
      <div class="kpi-delta neutral"><span>${k.highlight.obs || '—'}</span></div>
    </div>
  `;
}

// ── Store cards ───────────────────────────────────────────────────────────────

function renderStoreCards(month) {
  const panel = document.getElementById('fin-stores-panel');
  const container = document.getElementById('fin-store-cards');

  if (!month.stores) {
    container.innerHTML = `<div class="fin-empty">Detalhamento por loja disponível a partir de março/2026.</div>`;
    return;
  }

  const order = ['albatroz', 'tagus', 'point'];
  const names = { albatroz: 'Albatroz', tagus: 'Tagus II', point: 'The Point' };

  container.innerHTML = order.map(key => {
    const s = month.stores[key];
    if (!s) return '';
    return `
      <div class="fin-store-card${s.highlight ? ' highlight' : ''}">
        <div class="fin-store-header">
          <div class="fin-store-name">
            <div class="fin-store-dot" style="background:${FIN_COLORS[key]}"></div>
            ${names[key]}
          </div>
          <div>
            <div class="fin-store-receita">${fmtBRL(s.receita)}</div>
            <div class="fin-store-obs">${s.share}% da receita · ${s.obs}</div>
          </div>
        </div>
        <div class="fin-store-stats">
          <div class="fin-store-stat">
            <div class="fin-store-stat-label">Fat/dia</div>
            <div class="fin-store-stat-val">${fmtBRL(s.fatDia)}</div>
          </div>
          <div class="fin-store-stat">
            <div class="fin-store-stat-label">Ticket</div>
            <div class="fin-store-stat-val">${fmtBRLDec(s.ticketMedio)}</div>
          </div>
          <div class="fin-store-stat">
            <div class="fin-store-stat-label">Margem</div>
            <div class="fin-store-stat-val" style="color:${s.margem >= 51 ? 'var(--green)' : s.margem >= 49 ? 'var(--yellow)' : 'var(--red)'}">${s.margem.toFixed(1)}%</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ── DRE ───────────────────────────────────────────────────────────────────────

function renderDRE(month) {
  const title = document.getElementById('fin-dre-title');
  const sub = document.getElementById('fin-dre-sub');
  const content = document.getElementById('fin-dre-content');

  title.textContent = `DRE Gerencial`;
  sub.textContent = `${month.label} 2026`;

  const d = month.dre;

  const rows = [];
  const row = (label, val, cls, indent) =>
    `<tr class="${indent ? 'fin-dre-muted' : ''}"><td>${indent ? label : `<strong>${label}</strong>`}</td><td class="${cls || 'fin-dre-num'}">${val}</td></tr>`;

  if (d.receitaBruta) {
    rows.push(row('Receita bruta de vendas', fmtBRL(d.receitaBruta), 'fin-dre-num'));
    if (d.deducoes) rows.push(row('Deduções (impostos, devoluções)', fmtBRL(d.deducoes), 'neg', true));
    rows.push(`<tr class="fin-dre-total"><td>Receita líquida</td><td class="fin-dre-num">${fmtBRL(d.receitaLiquida)}</td></tr>`);
  } else {
    rows.push(row('Receita (Onii)', fmtBRL(month.kpis.receita), 'fin-dre-num'));
  }

  if (d.cmvDRE) rows.push(row('CMV — custo das mercadorias', `−${fmtBRL(Math.abs(d.cmvDRE))}`, 'neg', true));
  if (d.cmvOnii && d.cmvOnii !== d.cmvDRE) {
    rows.push(`<tr class="fin-dre-muted"><td style="padding-left:10px;font-size:10px;color:var(--text-muted)" colspan="2">CMV real Onii: ${fmtBRL(d.cmvOnii)} · CMV compras DRE: ${fmtBRL(d.cmvDRE)}</td></tr>`);
  }

  rows.push(`<tr class="fin-dre-total"><td>Lucro bruto</td><td class="${d.lbOnii ? 'pos' : 'warn'}">${fmtBRL(d.lbOnii || d.lbDRE)}</td></tr>`);

  if (d.despesasOp) rows.push(row('Despesas operacionais', `−${fmtBRL(Math.abs(d.despesasOp))}`, 'neg', true));
  if (d.receitasFinanceiras) rows.push(row('Receitas financeiras', `+${fmtBRL(d.receitasFinanceiras)}`, 'pos', true));
  if (d.capex && d.capex > 0) rows.push(row(`Capex${month.id === '2026-03' ? ' (freezer + equipamentos The Point)' : ''}`, `−${fmtBRL(d.capex)}`, 'neg', true));

  rows.push(`<tr class="fin-dre-total fin-dre-highlight"><td>Resultado (DRE)</td><td class="${d.resultado >= 0 ? 'pos' : 'neg'}">${d.resultado >= 0 ? '+' : ''}${fmtBRL(d.resultado)}</td></tr>`);

  if (d.resultadoOnii) {
    rows.push(`<tr class="fin-dre-muted"><td style="color:var(--text-muted)">Resultado real operacional (CMV Onii)</td><td class="pos" style="text-align:right">${fmtBRL(d.resultadoOnii)}</td></tr>`);
  }

  content.innerHTML = `
    <table class="fin-dre-table"><tbody>${rows.join('')}</tbody></table>
    ${d.nota ? `<div class="fin-dre-nota">* ${d.nota}</div>` : ''}
  `;
}

// ── Série histórica ───────────────────────────────────────────────────────────

function renderSerie(month) {
  const content = document.getElementById('fin-serie-content');
  const months = finData.months;

  const totalReceita = months.reduce((s, m) => s + (m.kpis.receita || 0), 0);
  const totalRes = months.reduce((s, m) => s + (m.kpis.resultado || 0), 0);

  const rows = months.map(m => {
    const isActive = m.id === month.id;
    const res = m.kpis.resultado;
    return `
      <tr class="${isActive ? 'fin-serie-active' : ''}">
        <td>${m.label}</td>
        <td class="align-right">${fmtBRL(m.kpis.receita)}</td>
        <td class="align-right" style="color:var(--text-muted);font-size:11px">${fmtBRL(m.dre.despesasOp || 0)}</td>
        <td class="${res >= 0 ? 'pos' : 'neg'}">${res >= 0 ? '+' : ''}${fmtBRL(res)}</td>
      </tr>
    `;
  }).join('');

  content.innerHTML = `
    <table class="fin-serie-table">
      <thead>
        <tr>
          <th>Mês</th>
          <th class="align-right">Receita</th>
          <th class="align-right">Desp. Op.</th>
          <th class="align-right">Resultado</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr>
          <td>Acumulado</td>
          <td class="align-right">${fmtBRL(totalReceita)}</td>
          <td class="align-right" style="color:var(--text-muted)">—</td>
          <td class="${totalRes >= 0 ? 'pos' : 'neg'}">${totalRes >= 0 ? '+' : ''}${fmtBRL(totalRes)}</td>
        </tr>
      </tbody>
    </table>
  `;
}

// ── Alertas ───────────────────────────────────────────────────────────────────

function renderAlerts(month) {
  const sub = document.getElementById('fin-alerts-sub');
  const container = document.getElementById('fin-alerts');

  sub.textContent = `${month.label} 2026`;

  if (!month.alerts || !month.alerts.length) {
    container.innerHTML = '<div class="fin-empty">Nenhum alerta registrado para este mês.</div>';
    return;
  }

  container.innerHTML = month.alerts.map(a => `
    <div class="fin-alert ${a.type}">
      <div class="fin-alert-icon">${a.icon}</div>
      <div>${a.text}</div>
    </div>
  `).join('');
}

// ── Top 15 ────────────────────────────────────────────────────────────────────

function renderTop15(month) {
  const section = document.getElementById('fin-top15-section');
  const sub = document.getElementById('fin-top15-sub');
  const body = document.getElementById('fin-top15-body');

  if (!month.top15) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  sub.textContent = `${month.label} 2026`;

  body.innerHTML = month.top15.map(p => {
    const margemCls = p.margem >= 55 ? 'fin-margem-high' : p.margem >= 45 ? 'fin-margem-mid' : 'fin-margem-low';
    const badge = p.badge
      ? `<span class="fin-badge${p.badge.includes('↑') ? ' up' : ''}">${p.badge}</span>`
      : '';
    return `
      <tr>
        <td class="fin-rank">${String(p.rank).padStart(2, '0')}</td>
        <td>${p.nome}${badge}</td>
        <td class="align-right" style="font-variant-numeric:tabular-nums">${fmtBRL(p.receita)}</td>
        <td class="align-right" style="color:var(--text-muted)">${p.qtd}</td>
        <td class="align-right ${margemCls}">${p.margem}%</td>
      </tr>
    `;
  }).join('');
}

// ── Próximo mês ───────────────────────────────────────────────────────────────

function renderNext(month) {
  const row = document.getElementById('fin-next-row');
  const title = document.getElementById('fin-next-title');
  const desafios = document.getElementById('fin-desafios');
  const oportunidades = document.getElementById('fin-oportunidades');

  if (!month.next) {
    row.style.display = 'none';
    return;
  }

  row.style.display = 'grid';
  title.textContent = month.next.title;
  desafios.innerHTML = month.next.desafios.map(d => `<li>${d}</li>`).join('');
  oportunidades.innerHTML = month.next.oportunidades.map(o => `<li>${o}</li>`).join('');
}

// ── Gráfico histórico DRE ────────────────────────────────────────────────────

function renderHistoricalChart() {
  const ctx = document.getElementById('chart-hist-dre');
  if (!ctx) return;

  const months = finData.months;
  const labels  = months.map(m => m.shortLabel);
  const lbData  = months.map(m => m.dre.lbOnii || m.dre.lbDRE || 0);
  const despData = months.map(m => m.dre.despesasOp || 0);
  const resData  = months.map(m => m.kpis.resultado || 0);

  if (chartHist) chartHist.destroy();

  chartHist = new Chart(ctx, {
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Lucro bruto',
          data: lbData,
          backgroundColor: 'rgba(31,212,122,0.55)',
          borderWidth: 0,
          order: 2,
        },
        {
          type: 'bar',
          label: 'Despesas op.',
          data: despData,
          backgroundColor: 'rgba(240,90,106,0.55)',
          borderWidth: 0,
          order: 2,
        },
        {
          type: 'line',
          label: 'Resultado',
          data: resData,
          borderColor: '#f0be3c',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: '#f0be3c',
          tension: 0.2,
          order: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...TOOLTIP_BASE,
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: R$ ${Math.abs(ctx.raw || 0).toLocaleString('pt-BR')}`,
          },
        },
      },
      scales: {
        x: { ticks: { color: TC, font: { size: 11 } }, grid: { color: GC } },
        y: {
          ticks: {
            color: TC,
            font: { size: 10 },
            callback: v => 'R$' + (v / 1000).toFixed(0) + 'k',
          },
          grid: { color: GC },
        },
      },
    },
  });
}

// ── Gráficos do mês ───────────────────────────────────────────────────────────

function renderMonthCharts(month) {
  const row = document.getElementById('fin-month-charts-row');

  if (!month.chartSemanal) {
    row.style.display = 'none';
    if (chartSemanal) { chartSemanal.destroy(); chartSemanal = null; }
    if (chartDow)     { chartDow.destroy();     chartDow = null; }
    return;
  }

  row.style.display = 'grid';

  document.getElementById('fin-semanal-title').textContent = 'Faturamento Semanal';
  document.getElementById('fin-semanal-sub').textContent = `${month.label} 2026`;
  document.getElementById('fin-dow-title').textContent = 'Por Dia da Semana';
  document.getElementById('fin-dow-sub').textContent = month.chartDow?.unit || '';

  // Semanal chart
  const ctxS = document.getElementById('chart-semanal');
  if (ctxS) {
    if (chartSemanal) chartSemanal.destroy();
    const cs = month.chartSemanal;
    chartSemanal = new Chart(ctxS, {
      type: 'bar',
      data: {
        labels: cs.labels,
        datasets: [
          { label: 'Albatroz', data: cs.albatroz, backgroundColor: '#4f7cff', borderWidth: 0 },
          { label: 'Tagus II', data: cs.tagus,    backgroundColor: '#f0be3c', borderWidth: 0 },
          { label: 'The Point',data: cs.point,    backgroundColor: '#1fd47a', borderWidth: 0 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { ...TOOLTIP_BASE, callbacks: { label: ctx => ` ${ctx.dataset.label}: R$ ${(ctx.raw || 0).toLocaleString('pt-BR')}` } } },
        scales: {
          x: { stacked: true, ticks: { color: TC, font: { size: 10 } }, grid: { color: GC } },
          y: { stacked: true, ticks: { color: TC, font: { size: 10 }, callback: v => 'R$' + (v / 1000).toFixed(1) + 'k' }, grid: { color: GC } },
        },
      },
    });
  }

  // DoW chart
  const ctxD = document.getElementById('chart-dow');
  if (ctxD) {
    if (chartDow) chartDow.destroy();
    const cd = month.chartDow;
    chartDow = new Chart(ctxD, {
      type: 'bar',
      data: {
        labels: cd.labels,
        datasets: [
          { label: 'Albatroz', data: cd.albatroz, backgroundColor: '#4f7cff', borderWidth: 0 },
          { label: 'Tagus II', data: cd.tagus,    backgroundColor: '#f0be3c', borderWidth: 0 },
          { label: 'The Point',data: cd.point,    backgroundColor: '#1fd47a', borderWidth: 0 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { ...TOOLTIP_BASE, callbacks: { label: ctx => ` ${ctx.dataset.label}: R$ ${(ctx.raw || 0).toLocaleString('pt-BR')}` } } },
        scales: {
          x: { ticks: { color: TC, font: { size: 11 } }, grid: { color: GC } },
          y: { ticks: { color: TC, font: { size: 10 }, callback: v => 'R$' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v) }, grid: { color: GC } },
        },
      },
    });
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────

loadData();
