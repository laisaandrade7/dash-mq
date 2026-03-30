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
- Ranking de lojas por faturamento
- Gráfico comparativo entre lojas (últimos 7 dias)
- Ticket médio por loja
- Insights automáticos

### Vendas (`vendas.html`)
- KPIs do período selecionado
- Gráfico de evolução de faturamento
- Ranking por loja com destaque de melhor/pior
- Gráfico de ticket médio por loja
- Tabela detalhada de vendas (data, loja, fat, nº vendas, ticket)
- Filtros: período (Hoje / 7 / 15 / 30 dias / Mês) e loja

---

## Stack Tecnológica

### Pipeline de dados (`scripts/`)
- Node.js
- Playwright — login automatizado no Onii (sem API pública de autenticação)
- `basic-ftp` — upload para Hostinger
- Orquestrado por `sync-onii.js`

### Dashboard web
- HTML + CSS + JavaScript puro (sem frameworks)
- Chart.js + chartjs-plugin-datalabels
- Dark theme premium
- Responsivo (mobile-first)

### Infraestrutura
- Hostinger (LiteSpeed) via FTP
- GitHub Actions para sync automático (cron a cada 30 min)

---

## Direção de Design
- BI moderno, dark theme premium
- Hierarquia visual clara, baixo esforço cognitivo
- Visão geral primeiro, detalhe depois
- Comparação fácil entre lojas

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
