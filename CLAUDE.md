# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run sync          # Pipeline completo: login → fetch → transform → FTP upload
npm run sync:no-ftp   # Pipeline sem upload (útil para testar localmente)
npm run sync -- --days 7   # Últimos N dias (padrão: 30)
npm run deploy        # Envia todos os arquivos estáticos + JSONs via FTP (full deploy)
npm run upload        # Envia apenas os JSONs de dados via FTP
npm run test          # Testes de regressão de timezone (BRT vs UTC)
npm run serve         # Servidor local para visualizar o dashboard
```

## Architecture

O projeto tem dois papéis distintos: **pipeline de dados** (Node.js/scripts) e **dashboard web** (HTML/CSS/JS estático).

### Pipeline de dados (`scripts/`)

```
login-onii.js      → Playwright: abre browser, faz login no Onii, captura Bearer token
fetch-onii.js      → Usa o token para chamar a API REST do Onii e baixar transações
transform-sales.js → Normaliza os dados brutos e gera sales.json + history.json
save-json.js       → Persiste os JSONs em /data com backup
upload-ftp.js      → Envia arquivos para o servidor Hostinger via FTP (basic-ftp)
sync-onii.js       → Orquestrador: executa todas as etapas na ordem correta
```

### Dashboard web

- `index.html` + `js/main.js` → Visão geral: faturamento, ranking, ticket médio, insights
- `vendas.html` + `js/vendas.js` → Histórico: gráfico por período, ranking, tabela detalhada
- `css/main.css` → Dark theme, layout, topbar, cards, responsividade
- `css/vendas.css` → Estilos específicos da página de Vendas
- `data/sales.json` e `data/history.json` → consumidos pelo frontend via `fetch()`

### Fluxo de dados

```
Onii (POS) → API REST → _raw.json → transform → sales.json + history.json → FTP → dashboard web
```

### Layout

O dashboard usa **topbar fixa full-width** (sem sidebar). Estrutura do topbar:
- **Left:** brand icon + "Minha Quitandinha" | tabs de navegação (Visão Geral / Vendas)
- **Right:** filtros de período | date picker | filtro de loja (só vendas) | refresh | sync label | avatar
- **Mobile:** topbar-nav oculto (substituído pela bottom-nav), brand mostra só ícone

## Critical: Timezone Bug (BRT vs UTC)

O Onii armazena `createdAt` em **UTC**, mas exibe datas em **BRT (UTC-3)**. Transações entre 21:00–23:59 BRT têm `createdAt` com data UTC do dia seguinte.

**Toda função que extrai ou compara datas DEVE subtrair 3h antes:**

```javascript
// CORRETO — converte para BRT antes de extrair a data
const d = new Date(raw.createdAt);
d.setTime(d.getTime() - 3 * 60 * 60 * 1000);
const iso = d.toISOString().split('T')[0];

// ERRADO — extrai direto em UTC (vai errar para transações noturnas)
const iso = raw.createdAt.slice(0, 10);
```

Funções afetadas: `normalizeRow()` e `todayISO()` em `transform-sales.js`, `isoDate()` em `sync-onii.js`.

Rodar `npm test` valida os casos de borda: 21:59, 22:30, 23:59, 00:01 BRT.

## Environment (.env)

```
ONII_EMAIL / ONII_PASSWORD    → credenciais do Onii (merchant.onii.app)
STORE_ALBATROZ / STORE_POINT / STORE_TAGUS / STORE_CD → "id|nome" de cada loja
FTP_HOST / FTP_USER / FTP_PASSWORD → credenciais FTP Hostinger
FTP_REMOTE_PATH               → caminho no servidor (ex: /domains/laisaandrade.com.br/public_html/dash-mq)
FTP_SECURE                    → true para FTPS
HEADLESS=false                → abre browser visível (útil para depurar login)
DATA_OUTPUT_DIR=./data        → onde os JSONs são salvos
```

**FTP path no Hostinger:** O FTP user `u647093476` tem root em `/home/u647093476/`. O caminho correto é `/domains/laisaandrade.com.br/public_html/dash-mq` (sem prefixo `/home/u647093476`). O hPanel mostra o caminho absoluto (`/home/u647093476/domains/...`), mas o FTP usa o caminho relativo ao home do usuário.

## FTP — Retry automático

`upload-ftp.js` tem retry de 3 tentativas com 5s de intervalo e timeout de 30s no socket de controle. Isso resolve timeouts transientes do Hostinger a partir do GitHub Actions.

## Deploy

- `npm run upload` → atualiza apenas os JSONs de dados (usado a cada sync automático)
- `npm run deploy` → envia tudo, incluindo HTML/CSS/JS (usar após mudanças no frontend)
- O servidor é Hostinger com LiteSpeed — `.htaccess` do Apache pode não ter efeito

## Stores

```
albatroz → Minha Quitandinha - Condomínio do Edíficio Albatroz
point    → Minha Quitandinha - Condominio do Edificio The Point Offices
tagus    → Minha Quitandinha - Edíficio Tagus II
cd       → CD (Centro de Distribuição — NÃO aparece no dashboard de vendas)
```

O CD não é incluído no `CONFIG.stores` do `sync-onii.js` para fins de relatório de vendas.
