# Projeto: Dashboard Minha Quitandinha

## Objetivo
Dashboard operacional web para as lojas Minha Quitandinha, com foco em clareza, usabilidade e tomada de decisão rápida. Substitui o acompanhamento manual no Notion.

Consolida dados de vendas das lojas a partir do sistema POS Onii, apresentando métricas em tempo real com atualização automática.

---

## Estrutura do Negócio

### Lojas (aparecem no dashboard)
- Albatroz
- Tagus II
- The Point Offices

### Centro de Distribuição
- CD central — excluído do relatório de vendas

---

## Status Atual (V1 — em produção)

- Dashboard ao vivo em `dash-mq.laisaandrade.com.br`
- Sync automático a cada 30 min via GitHub Actions
- Dados reais do Onii (POS) via Playwright + REST API
- Sem autenticação (acesso público via URL)

---

## Funcionalidades Ativas

### Visão Geral (`index.html`)
- KPIs do dia: faturamento, vendas aprovadas, ticket médio (com variação vs ontem)
- Ranking de lojas por faturamento (card ocupa altura total, itens se expandem)
- Gráfico comparativo entre lojas (últimos 7 dias por padrão)
- Ticket médio por loja
- Insights automáticos (abaixo do ranking, col 1)
- Filtros: período (Hoje / 7 / 15 / 30 dias) e date picker personalizado

### Vendas (`vendas.html`)
- KPIs do período: faturamento, total de vendas, ticket médio, variação vs período anterior
  - Card de variação exibe datas reais do período comparado (ex: "18/03 – 24/03")
- Visualização "Hoje": cards por loja com faturamento, vendas e ticket médio (sem gráfico)
- Gráfico de evolução: linha por loja + linha "Total" tracejada (visível só em "Todas")
- Ranking horizontal por loja com destaque de melhor/pior
- Gráfico de ticket médio por loja
- Insights automáticos do período
- Tabela detalhada de vendas (data, loja, fat, nº vendas, ticket)
- Filtros: período (Hoje / 7 / 15 / 30 dias / Mês), date picker personalizado e loja

### Layout
- Topbar fixa full-width: brand + nav tabs (esq.) | filtros + sync + avatar (dir.)
- Sem sidebar — navegação via topbar-nav (desktop) e bottom-nav (mobile)
- Mobile: topbar-nav oculto, bottom-nav com Início e Vendas

---

## Stack Tecnológica

### Pipeline de dados (`scripts/`)
- Node.js
- Playwright — login automatizado no Onii (sem API pública de autenticação)
- `basic-ftp` — upload para Hostinger com retry automático (3x, 5s intervalo, 30s timeout)
- Orquestrado por `sync-onii.js`

### Dashboard web
- HTML + CSS + JavaScript puro (sem frameworks)
- Chart.js + chartjs-plugin-datalabels
- Dark theme premium, layout full-width

### Infraestrutura
- Hostinger (LiteSpeed) via FTP
- GitHub Actions para sync automático (cron a cada 30 min, 06h–23h BRT)

---

## Direção de Design
- BI moderno, dark theme premium
- Hierarquia visual clara, baixo esforço cognitivo
- Visão geral primeiro, detalhe depois
- Comparação fácil entre lojas
- Layout full-width (sem sidebar) para máximo aproveitamento de tela

---

## Estrutura de Dados

- `data/sales.json` — resumo do dia atual por loja
- `data/history.json` — registros diários por loja (últimos N dias)

---

## Roadmap Futuro
- Página de Estoque com integração de dados reais
- Alerta de ruptura de estoque
- Sugestão de reposição semanal
- Briefing matinal automatizado
- Redistribuição entre lojas
- Planejamento de envio do CD
- Relatório mensal de rentabilidade
- Autenticação (Google Login)
