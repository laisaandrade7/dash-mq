# Decisões do Projeto

## Arquitetura
- Pipeline de dados separado do dashboard (Node.js scripts vs HTML/CSS/JS estático)
- Sem backend ativo: o dashboard apenas consome JSONs gerados pelo pipeline
- Dois JSONs de saída: `sales.json` (dia atual) e `history.json` (N dias)
- Login no Onii feito via Playwright (browser automation) porque não há API de autenticação pública

## Timezone
- O Onii armazena `createdAt` em UTC, mas exibe e filtra por BRT (UTC-3)
- Decisão: toda extração de data subtrai 3h antes de fazer `.split('T')[0]`
- Transações entre 21:00–23:59 BRT têm data UTC do dia seguinte — o fix cobre esse caso
- Testes de regressão criados em `scripts/test-brt-dates.js` para proteger esse comportamento

## Cache
- Fetch dos JSONs no frontend usa `?t=${Date.now()}` para evitar dados obsoletos no browser (LiteSpeed faz cache agressivo)

## FTP / Deploy
- FTP host: IP direto `195.179.238.2` (DNS `ftp.laisaandrade.com.br` pode ter latência de propagação)
- FTP user root é `/home/u647093476/` → caminhos no `.env` são relativos a esse root (ex: `/domains/...`)
- `upload-ftp.js` tem retry de 3 tentativas (5s de intervalo) e timeout de 30s — resolve timeouts transientes do GitHub Actions
- Dois modos de upload: `npm run upload` (só JSONs) e `npm run deploy` (tudo)
- Servidor Hostinger usa LiteSpeed — `.htaccess` Apache pode não ter efeito

## Subdomain
- Dashboard publicado em `dash-mq.laisaandrade.com.br`
- Diretório no servidor: `/home/u647093476/domains/laisaandrade.com.br/public_html/dash-mq`
- Domínio raiz `laisaandrade.com.br` tem WordPress instalado em `public_html` — não mexer

## Sync Automático
- GitHub Actions roda `npm run sync` a cada 30 min (06h–23h BRT)
- Cron: `*/30 9-23,0-2 * * *` (UTC)
- Credenciais armazenadas como GitHub Secrets (não no repositório)
- O workflow faz upload FTP e também commita os JSONs atualizados de volta no repositório

## UX / Design
- Dark theme obrigatório — estética BI moderno premium
- Layout full-width: sem sidebar, topbar fixa com brand + nav tabs à esquerda e filtros à direita
- Sidebar foi removida (só havia 2 páginas; ocupava 248px desnecessários)
- Navegação entre páginas via links `<a href>` no topbar-nav (desktop) e bottom-nav (mobile)
- Mobile: topbar-nav oculto, bottom-nav cobre a navegação; brand mostra só ícone
- Gráficos usam `ctx.dataset.data[ctx.dataIndex]` (não `ctx.parsed.y`) no callback do datalabels
- Erros de fetch ficam isolados em try/catch separado dos renders para não sobrescrever DOM já renderizado
- Floating point no total diário do gráfico: arredondar com `Math.round(valor * 100) / 100` ao somar fat de múltiplas lojas

## Dados
- Apenas lojas (albatroz, point, tagus) aparecem no relatório de vendas — CD excluído
- `sales.json`: resumo do dia atual por loja (fat, vnd, tkt, ranking)
- `history.json`: registros diários por loja nos últimos N dias

## Páginas
- Visão Geral (`index.html`) e Vendas (`vendas.html`) são as únicas páginas ativas
- Histórico, Estoque e Insights foram removidos do escopo V1 para não poluir a navegação

## Visualizações

### Visão Geral (`index.html`)
- Grid 2 colunas: col 1 = Ranking de Lojas + Insights; col 2 = Gráfico Comparativo + Ticket Médio
- Ranking usa `display: flex; flex-direction: column` com `ranking-item { flex: 1 }` para preencher a altura total do card sem buracos

### Vendas (`vendas.html`)
- Filtro "Hoje" (period=1): substitui o gráfico por cards por loja (faturamento, vendas, ticket médio) usando `today-stores-view` posicionado absolutamente sobre o canvas
- Filtros 7/15/30/Mês: mostra gráfico de linha com dataset "Total" (linha tracejada branca/neutra) sobreposto às 3 linhas de loja — só aparece quando filtro de loja = "Todas"
- Card "Variação vs Período Anterior": delta mostra as datas reais do período comparado (ex: "18/03 – 24/03") em vez de texto genérico
