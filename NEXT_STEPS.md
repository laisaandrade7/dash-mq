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

## Pendente — Infraestrutura
- [ ] Remover arquivo de malware `bright-scanner-cue.php` de `public_html/wp-content/plugins/`
  - Usar hPanel File Manager: mudar permissão para 644, depois deletar

## Pendente — Dashboard
- [ ] Autenticação (V2: Google Login)
- [ ] Comparativo semanal automático nos insights
- [ ] Filtro de data personalizado (date picker) na página de Vendas

## Roadmap futuro
- Página de Estoque com integração de dados reais
- Alerta de ruptura de estoque
- Sugestão de reposição semanal
- Briefing matinal automatizado
- Redistribuição entre lojas
- Planejamento de envio do CD
- Relatório mensal de rentabilidade
