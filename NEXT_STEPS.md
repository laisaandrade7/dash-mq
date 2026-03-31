# Próximos Passos

## Concluído
- [x] Pipeline de dados (login → fetch → transform → FTP)
- [x] Fix de timezone UTC vs BRT
- [x] Testes de regressão de timezone
- [x] Cache-busting nos fetches do frontend
- [x] Deploy em `dash-mq.laisaandrade.com.br`
- [x] Sync automático via GitHub Actions (a cada 30 min, 06h–23h BRT)
- [x] Página de Vendas com histórico por período (7/15/30 dias) e filtro por loja
- [x] Mobile: navbar funcional, gráficos com valores, botões navegáveis
- [x] Remoção das páginas placeholder (Histórico, Estoque, Insights)
- [x] Filtro de data personalizado (date picker) na página de Vendas
- [x] FTP com retry automático e timeout explícito (resolve falhas do GitHub Actions)
- [x] Linha "Total" no gráfico de evolução (tracejada, neutra, só em "Todas as lojas")
- [x] Visão "Hoje" em Vendas: cards por loja em vez de gráfico vazio
- [x] Card "Variação vs Período Anterior" com datas reais do período comparado
- [x] Layout full-width: sidebar removida, navegação migrada para topbar
- [x] Ranking de Lojas preenche altura total do card (sem buraco preto)
- [x] Insights movidos para abaixo do Ranking na Visão Geral

## Pendente — Dashboard
- [ ] Autenticação (V2: Google Login)
- [ ] Comparativo semanal automático nos insights

## Roadmap futuro
- Página de Estoque com integração de dados reais
- Alerta de ruptura de estoque
- Sugestão de reposição semanal
- Briefing matinal automatizado
- Redistribuição entre lojas
- Planejamento de envio do CD
- Relatório mensal de rentabilidade
