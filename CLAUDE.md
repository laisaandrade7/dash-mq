# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run sync          # Pipeline completo: login → fetch → transform → stock → FTP upload
npm run sync:no-ftp   # Pipeline sem upload (útil para testar localmente)
npm run sync -- --days 7   # Últimos N dias (padrão: 30)
npm run deploy        # Envia todos os arquivos estáticos + JSONs via FTP (full deploy)
npm run upload        # Envia apenas os JSONs de dados via FTP
npm run test          # Testes de regressão de timezone (BRT vs UTC)
npm run test:data     # Gera dados de teste realistas em data/ para uso local
npm run serve         # Servidor local para visualizar o dashboard
```

## Architecture

O projeto tem dois papéis distintos: **pipeline de dados** (Node.js/scripts) e **dashboard web** (HTML/CSS/JS estático).

### Pipeline de dados (`scripts/`)

```
login-onii.js      → Playwright: abre browser, faz login no Onii, captura Bearer token
fetch-onii.js      → Usa o token para chamar a API REST do Onii e baixar transações
fetch-stock.js     → Busca estoque atual por loja via API Onii, classifica fornecedores, gera stock.json
transform-sales.js → Normaliza dados brutos e gera sales.json + history.json + products.json + transactions.json
save-json.js       → Persiste os JSONs em /data com backup
upload-ftp.js      → Envia arquivos para o servidor Hostinger via FTP (basic-ftp)
sync-onii.js       → Orquestrador: login → fetch → transform → stock → FTP
generate-test-data.js → Gera dados de teste realistas (30 dias, 3 lojas, 25 produtos)
```

### Dashboard web

- `index.html` + `js/main.js` → Visão geral: faturamento, ranking, ticket médio, insights
- `vendas.html` + `js/vendas.js` → Histórico: gráfico por período, ranking, tabela detalhada
- `produtos.html` + `js/produtos.js` → Produtos & Estoque: alertas de reposição + busca de transações por produto
- `css/main.css` → Dark theme, layout, topbar, cards, responsividade
- `css/vendas.css` → Estilos específicos da página de Vendas
- `css/produtos.css` → Estilos específicos da página de Produtos & Estoque

### JSONs consumidos pelo frontend

```
data/sales.json        → resumo do dia atual por loja
data/history.json      → histórico diário (N dias) por loja
data/products.json     → vendas agregadas por produto com breakdown por loja
data/stock.json        → estoque atual com alertas de reposição (cq < iq)
data/transactions.json → cada transação com seus itens de carrinho (date, time, store, items[])
```

### Fluxo de dados

```
Onii (POS) → API REST → _raw.json → transform → sales.json + history.json + products.json + transactions.json
                                                                                   ↓
                      API produtos → fetch-stock.js → stock.json
                                                                                   ↓
                                                              FTP → dashboard web
```

### Layout

O dashboard usa **topbar fixa full-width** (sem sidebar). Estrutura do topbar:
- **Left:** brand icon + "Minha Quitandinha" | nav de páginas (Visão Geral / Produtos)
- **Right:** filtros e controles específicos de cada página
- **Mobile:** topbar-nav oculto (substituído pela bottom-nav com 2 itens), brand mostra só ícone

## Página Produtos (`produtos.html`)

### Seção: Alertas de Reposição

- Mostra produtos com `cq <= 3` (quantidade atual ≤ 3), ordenados por `cq` asc
- Colunas ordenáveis: Produto, Fornecedor, Loja, Atual
- Filtro por fornecedor e por loja (topbar)
- Urgência: `row-urgent` (cq = 0), `row-warning` (faltam ≥ estoque ideal)

### Seção: Vendas por Produto

- Busca interativa: usuário digita → sugestões de produtos com match destacado
- Clica no produto → exibe tabela de transações individuais (Data, Hora, Loja, Qtd, Valor)
- Filtro por loja funciona tanto nas sugestões quanto nas transações exibidas
- Fonte de dados: `transactions.json`

### Dados de estoque (`stock.json`)

Campos relevantes por item em `low[]`:
- `cq` — quantidade atual (current quantity)
- `iq` — quantidade ideal do planograma
- `store` — chave da loja (`albatroz` / `point` / `tagus`)
- `supplier` — fornecedor classificado pelo `fetch-stock.js`

### Dados de transações (`transactions.json`)

Cada transação:
```json
{
  "date": "2026-04-27",
  "time": "14:32",
  "store": "albatroz",
  "storeName": "Albatroz",
  "total": 12.50,
  "items": [
    { "name": "Coca-Cola Lata 350ml", "ean": "7894900010015", "qty": 2, "price": 1.50, "total": 3.00 }
  ]
}
```

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

Funções afetadas: `normalizeRow()`, `todayISO()` e `buildTransactionsJSON()` em `transform-sales.js`, `isoDate()` em `sync-onii.js`.

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

`upload-ftp.js` tem retry de 5 tentativas com 15s de intervalo e timeout de 60s no socket de controle. Isso resolve timeouts transientes do Hostinger a partir do GitHub Actions.

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

## Classificação de fornecedores (`fetch-stock.js`)

O campo `supplier` é derivado automaticamente do nome do produto via regex. Fornecedores mapeados:

```
Eskimó         → produtos contendo "eskimó" / "eskimo"
LivUp          → produtos contendo "liv up" / "livup"
Puri           → produtos contendo "puri"
Coca-Cola      → Coca-Cola, Sprite, Fanta, Schweppes, Del Valle, Monster, etc.
Bees (Ambev)   → Brahma, Skol, Stella, Budweiser, Guaraná Antarctica, Red Bull, etc.
Bees (Pepsico) → Pepsi, Gatorade, Doritos, Ruffles, Lays, Cheetos, Toddynho, etc.
Outros         → fallback para produtos não mapeados
```
