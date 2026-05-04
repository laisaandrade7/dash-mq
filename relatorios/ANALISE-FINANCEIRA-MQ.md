# Análise Financeira Mensal — Minha Quitandinha
## Guia completo de execução no VS Code

> Documento gerado em 04/05/2026 com base na rotina estabelecida ao longo de abril/2026.
> Consolida fontes de dados, ritual mensal, aprendizados e decisões de design.

---

## 1. Visão geral da rotina

A análise financeira mensal cruza três fontes de dados para produzir um relatório interativo HTML
publicado em `laisaandrade.com.br/dash-mq/relatorios/` e arquivado no Notion (Gestão Lojas MQ).

```
Controlle (CSV + DRE)  ─┐
Onii (transações xlsx)  ├──► Claude (claude.ai) ──► HTML ──► Hostinger ──► Notion
history.json (auto)    ─┘
```

**Quando:** primeiro dia útil de cada mês (evento recorrente no Google Calendar).
**Tempo estimado:** 15–20 minutos.

---

## 2. Fontes de dados

| Fonte | O que contém | Como obter | Automático? |
|---|---|---|---|
| Controlle — CSV lançamentos | Fluxo de caixa completo (receitas, despesas, categorias) | Controlle → Lançamentos → Exportar CSV | Manual |
| Controlle — DRE gerencial | Resultado mensal (receita, CMV, margem, despesas, lucro) | Controlle → Relatórios → DRE Gerencial → xlsx | Manual |
| Onii — transações | Vendas produto a produto com custo, margem, horário | Onii → Relatórios → Transações → todas as lojas → xlsx | Manual |
| Onii — history.json | Faturamento diário por loja (30 dias) | `https://dash-mq.laisaandrade.com.br/data/history.json` | **Automático** |

> O `history.json` é buscado pelo Claude diretamente via URL — não precisa ser exportado.

---

## 3. Ritual mensal passo a passo

### Passo 1 — Exportar os 3 arquivos (antes de abrir o Claude)

**Controlle — CSV de lançamentos:**
1. Acesse [controlle.com](https://controlle.com) → Lançamentos
2. Filtro: competência do mês fechado (ex: 01/04 a 30/04)
3. Exportar → CSV
4. Salvar como: `arquivo-exportacao-lancamentos.csv`

**Controlle — DRE gerencial:**
1. Controlle → Relatórios → DRE Gerencial
2. Selecionar o ano corrente
3. Exportar → xlsx
4. Salvar como: `exportacao-relatorio-dre-gerencial-[data].xlsx`

**Onii — transações de todas as lojas:**
1. Painel Onii → Relatórios → Transações
2. Filtro: período do mês fechado / todas as lojas
3. Exportar → xlsx
4. Salvar como: `Transacoes_Todas_as_lojas_[ano]-[mês]-01_-_[ano]-[mês]-30.xlsx`

---

### Passo 2 — Abrir o Claude e enviar os arquivos

Acesse [claude.ai](https://claude.ai) e use esta mensagem de abertura:

```
Vamos fazer a análise financeira de [MÊS/ANO]. Seguem os arquivos.
```

Anexe os 3 arquivos exportados. O Claude irá:
- Processar os arquivos automaticamente
- Buscar o `history.json` do Onii via URL pública
- Cruzar os dados das três fontes
- Gerar o HTML do relatório
- Disponibilizar o arquivo para download

---

### Passo 3 — Deploy no Hostinger via GitHub Actions

1. Salve o HTML gerado pelo Claude em:
   ```
   dash-mq/relatorios/relatorio-[mes]-[ano].html
   ```
   Exemplos:
   - `relatorio-abril-2026.html`
   - `relatorio-maio-2026.html`

2. Faça commit e push no repositório `dash-mq`:
   ```bash
   git add relatorios/relatorio-[mes]-[ano].html
   git commit -m "feat: relatório financeiro [mês]/[ano]"
   git push
   ```

3. O GitHub Actions faz o deploy automaticamente no Hostinger.

4. URL final:
   ```
   https://laisaandrade.com.br/dash-mq/relatorios/relatorio-[mes]-[ano].html
   ```

5. Confirme a URL para o Claude → ele cria a página no Notion automaticamente.

---

### Passo 4 — Página no Notion (automático via Claude)

Após confirmar a URL, o Claude cria uma página dentro de **Gestão Lojas MQ** com:
- Link clicável para o relatório interativo
- Embed inline do HTML
- Resumo executivo em tabela
- Alertas do mês em bullets
- Checklist para o mês seguinte

---

## 4. Estrutura do relatório HTML gerado

Cada relatório tem as seguintes seções:

| Seção | Conteúdo |
|---|---|
| Resumo executivo | 4 KPIs: receita, lucro bruto, resultado, The Point |
| Performance por loja | Cards com fat/dia, ticket, margem, transações, melhor dia |
| Faturamento semanal | Gráfico de barras empilhadas por loja |
| Resultado DRE jan–mês | Série histórica lucro bruto vs despesas vs resultado |
| Faturamento por dia da semana | Padrão de consumo por loja |
| Evolução diária acumulada | Curva de acumulação do mês |
| Top 15 produtos | Ranking por receita com margem e novidades |
| DRE simplificado | Tabela com receita, CMV, LB, despesas, resultado |
| Alertas e oportunidades | Cards coloridos com os principais achados |
| Visão acumulada do ano | Tabela histórica jan–mês |
| O que acompanhar no próximo mês | Desafios e oportunidades identificadas |

---

## 5. Aprendizados sobre os dados — decisões importantes

### 5.1 CMV: DRE vs Onii

O DRE do Controlle usa **compras de estoque** como CMV — isso infla o custo porque inclui
mercadorias que ainda não foram vendidas (estoque em trânsito no CD).

O CMV real é calculado pelo Onii: `custo unitário × quantidade vendida`.

| Métrica | DRE Controlle | Onii (real) |
|---|---|---|
| CMV abril | R$ 9.051 | R$ 7.178 |
| Margem bruta | 29,2% | 51,7% |

**Regra:** sempre usar o CMV do Onii para calcular a margem bruta real. O DRE serve para
o resultado final (lucro/prejuízo), que incorpora todas as despesas operacionais.

---

### 5.2 Transferências internas — excluir do resultado

Os seguintes lançamentos no Controlle distorcem o resultado e devem ser excluídos das análises:

```
Investimentos
Pagamento de Fatura
Rendimentos de Aplicações
Reposições
Receitas de Vendas (duplicidade)
```

---

### 5.3 Capex vs despesa operacional

Separar sempre:
- **Capex** (Máquinas e Equipamentos, Bens de Pequeno Valor, Benfeitorias, etc.) → investimento
- **Despesas operacionais** → custo recorrente do período

O capex distorce o resultado do mês em que ocorre (ex: março/26 teve R$ 7.374 de capex
da abertura da The Point). Reportar sempre o resultado com e sem capex.

---

### 5.4 Estoque em trânsito — gap compras vs CMV

O CD funciona como **buffer semanal**, não como armazém. As compras da semana entram
no Controlle no dia do pagamento, mas o CMV só aparece no Onii quando vendido.

Gap típico: R$ 1.300–1.900/mês → corresponde ao estoque que está no CD aguardando
distribuição. **Não é prejuízo** — é ativo (estoque) sendo tratado como despesa pelo DRE.

---

### 5.5 Perfil de cada loja — contexto para análise

| Loja | Perfil | Pico | Vende FDS? | Álcool? |
|---|---|---|---|---|
| Albatroz | Residencial noturno | 18h–22h | Sim | Sim (âncora) |
| Tagus II | Residencial noturno | 20h–22h | Sim | Sim (parcial) |
| The Point | Comercial dia | 12h–13h | Não (quase zero) | Não |

**Não comparar faturamento absoluto entre lojas sem contexto.** The Point opera ~22 dias
úteis/mês vs 30 dias das outras. Usar faturamento por dia útil para comparar.

---

### 5.6 Break-even da The Point

Cálculo baseado em custos incrementais e margem bruta histórica:

```
Custo incremental mensal:  R$ 2.422
Margem bruta média:        41,8%
Break-even mensal:         R$ 5.789
Break-even diário útil:    R$ 263  (22 dias úteis)
```

Abril/26: R$ 1.988 — ainda 66% abaixo do break-even.
Projeção para atingir: 4–6 meses no ritmo atual de crescimento.

---

### 5.7 Receita DRE vs Onii — divergência esperada

O DRE do Controlle pode diferir da receita do Onii por:
- Lançamentos fora do período de competência
- Transferências entre contas classificadas como receita
- Diferença entre data de venda e data de recebimento

Diferença típica observada: R$ 1.000–1.500/mês. Normal e esperada.

---

## 6. KPIs e metas de referência

| Indicador | Meta / Referência | Base |
|---|---|---|
| Receita mensal mínima para equilíbrio | R$ 12.500 | Cálculo despesas fixas + CMV |
| Margem bruta (Onii) | ≥ 50% | Histórico fev–abr/26 |
| Ticket médio Albatroz | ≥ R$ 16 | Histórico |
| Ticket médio Tagus | ≥ R$ 16 | Histórico |
| Ticket médio The Point | ≥ R$ 12 (meta) | Atual R$ 9,25 |
| Fat/dia Albatroz | ≥ R$ 300 | Histórico estável |
| Fat/dia Tagus | ≥ R$ 100 | Meta de recuperação |
| Fat/dia útil The Point | ≥ R$ 263 (break-even) | Cálculo |

---

## 7. Série histórica de referência

| Mês | Receita (Onii) | Resultado (DRE) | Observação |
|---|---|---|---|
| Jan/26 | R$ 11.372 | +R$ 946 | Apenas Alb + Tag (parcial) |
| Fev/26 | R$ 12.143 | −R$ 317 | Primeiro mês cheio fev |
| Mar/26 | R$ 13.260 | +R$ 922 | The Point abre 23/03 (9 dias) · capex R$ 7.374 |
| Abr/26 | R$ 14.855 | +R$ 1.791 | The Point primeiro mês completo · **melhor mês** |

---

## 8. Estrutura de arquivos no repositório

```
dash-mq/
├── relatorios/
│   ├── relatorio-marco-2026.html
│   ├── relatorio-abril-2026.html
│   └── relatorio-[mes]-[ano].html   ← novo arquivo todo mês
├── data/
│   ├── sales.json                   ← atualizado pelo sync a cada 30min
│   └── history.json                 ← atualizado pelo sync a cada 30min
└── .github/workflows/
    └── (deploy FTP automático)
```

---

## 9. Credenciais e acessos necessários

> ⚠️ **Nunca compartilhar credenciais no chat do Claude.**
> Usar variáveis de ambiente ou arquivo `.env` local.

| Sistema | Acesso necessário |
|---|---|
| Controlle | Login na conta para exportar relatórios |
| Onii | Acesso ao painel para exportar transações |
| GitHub | Push no repositório `dash-mq` |
| Hostinger | Deploy via GitHub Actions (secrets já configurados) |
| Claude | Conectores: Notion, Google Calendar ativos |

---

## 10. Alertas recorrentes a monitorar

A cada mês, verificar:

- [ ] **Tagus II** — faturamento em queda por 2+ meses consecutivos?
- [ ] **The Point** — crescimento semana a semana nos dias úteis?
- [ ] **Ticket Albatroz** — tendência de queda abaixo de R$ 15?
- [ ] **Picos de despesa** — concentração de vencimentos no final do mês?
- [ ] **Gap compras vs CMV** — acima de R$ 2.000? Pode indicar estoque acumulando
- [ ] **Novos produtos no top 15** — sinal de mudança no mix de consumo
- [ ] **Margem bruta** — abaixo de 49%? Revisar precificação
- [ ] **Despesas fixas** — crescimento acima de 5% mês a mês sem nova loja?

---

## 11. Contatos e referências rápidas

| Item | Valor |
|---|---|
| Dashboard Onii | `https://dash-mq.laisaandrade.com.br` |
| Relatórios mensais | `https://laisaandrade.com.br/dash-mq/relatorios/` |
| history.json (live) | `https://dash-mq.laisaandrade.com.br/data/history.json` |
| Gestão Lojas MQ (Notion) | `https://www.notion.so/31bd271d0f6d8021b965fa93172e3160` |
| Repositório dash-mq | `https://github.com/laisaandrade7/dash-mq` |
| Gestão de Estoque MQ (Notion DB) | ID: `329d271d-0f6d-807a-ac4a-000b456eb83c` |

---

*Última atualização: 04/05/2026 · Gerado com Claude (claude.ai)*
