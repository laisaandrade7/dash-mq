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
- Fetch dos JSONs no frontend usa `{ cache: 'no-store' }` para evitar dados obsoletos no browser

## FTP / Deploy
- FTP host: IP direto `195.179.238.2` (DNS `ftp.laisaandrade.com.br` pode ter latência de propagação)
- FTP user root é `/home/u647093476/` → caminhos no `.env` são relativos a esse root
- Dois modos de upload: `npm run upload` (só JSONs) e `npm run deploy` (tudo)
- Servidor Hostinger usa LiteSpeed — `.htaccess` Apache pode não ter efeito

## Subdomain
- Dashboard publicado em `dash-mq.laisaandrade.com.br`
- Diretório no servidor: `/home/u647093476/domains/laisaandrade.com.br/public_html/dash-mq`
- Domínio raiz `laisaandrade.com.br` tem WordPress instalado em `public_html` — não mexer

## UX / Design
- Dark theme obrigatório — estética BI moderno premium
- Desktop-first, responsividade secundária
- Componentes reutilizáveis em `css/` e `js/`

## Dados
- Apenas lojas (albatroz, point, tagus) aparecem no relatório de vendas — CD excluído
- `sales.json`: resumo do dia atual por loja (fat, vnd, tkt, ranking)
- `history.json`: registros diários por loja nos últimos N dias

## Escopo V1
- Apenas visualização — sem automações reais
- Autenticação V1: não implementada (dashboard público via URL)
- Estoque: estrutura de página prevista, dados ainda não integrados
