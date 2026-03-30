# Próximos Passos

## Concluído
- [x] Pipeline de dados (login → fetch → transform → FTP)
- [x] Fix de timezone UTC vs BRT
- [x] Testes de regressão de timezone
- [x] Cache-busting nos fetches do frontend
- [x] Deploy em `dash-mq.laisaandrade.com.br`

## Pendente — Infraestrutura
- [ ] Remover arquivo de malware `bright-scanner-cue.php` de `public_html/wp-content/plugins/`
  - Usar hPanel File Manager: mudar permissão para 644, depois deletar
- [ ] Configurar cron job no servidor para rodar `npm run sync` automaticamente (ex: a cada hora)
- [ ] Avaliar limpeza do WordPress de `public_html` (domínio raiz)

## Pendente — Dashboard
- [ ] Página de Estoque (layout pronto, dados não integrados)
- [ ] Página de Insights
- [ ] Filtros de período nas páginas de vendas
- [ ] Comparativo semanal
- [ ] Autenticação (V2: Google Login)

## Roadmap futuro
- Alerta de ruptura de estoque
- Sugestão de reposição semanal
- Briefing matinal automatizado
- Redistribuição entre lojas
- Planejamento de envio do CD
- Relatório mensal de rentabilidade
