# Licores por Encomenda — conexão da Cakto

O painel fica em /dash/. O projeto usa as tabelas D1 existentes: não há nova migração nesta atualização.

1. No Pages, Produção, mantenha DB e DASH_KEY configurados.
2. Na Cakto, Integrações > Webhooks, crie um webhook V1 ou V2 para Licores por Encomenda, evento purchase_approved, URL https://traqueamento.pages.dev/webhook/cakto.
3. Copie a chave secreta fornecida pela Cakto para CAKTO_WEBHOOK_SECRET no Pages (tipo Segredo). Não use a DASH_KEY e não envie o segredo por mensagens.
4. Refaça a implantação. O endpoint passa a aceitar entregas autenticadas.
5. Confira uma compra controlada e o histórico da Cakto. Se houver falha de persistência, reenvie pelo histórico. Eventos de teste aprovados também são registrados; não os confunda com vendas reais.

O script da página preserva utm_source, utm_medium, utm_campaign, utm_content e utm_term até os dois checkouts, na sessão atual. Use UTMs nos anúncios. Um clique sem UTM não recebe uma origem inventada.

O conector registra cada pedido aprovado uma vez, salva os itens na mesma transação e suporta lotes V2. Valores monetários da Cakto estão em reais (sem divisão por 100). Se headers de assinatura estiverem presentes, valida HMAC-SHA256 e timestamp; entregas legadas validam secret no corpo. Não há envio de Purchase CAPI pelo novo adaptador. O pixel PageView existente foi mantido.

## Investimento Meta Ads

Configure META_ADS_ACCESS_TOKEN, META_ADS_ACCOUNT_ID e SYNC_SECRET conforme docs/ad-spend-sync.md e ative a execução periódica ali descrita. Sem sincronização bem-sucedida o painel não exibe gastos, CPA ou ROAS como se fossem conhecidos.

Métricas: receita bruta aprovada, investimento importado, vendas, ticket médio, ROAS bruto, CPA geral (todas as vendas), resultado bruto (receita menos anúncios) e ROI bruto. Taxas, impostos, custos de produto, reembolsos e chargebacks não são descontados. Não são métricas de lucro líquido. Totais financeiros são em BRL; outras moedas ficam apenas na lista de vendas. Datas começam à meia-noite de Brasília, incluindo o dia atual; a conta de anúncios deve usar o mesmo fuso.

Campanhas de vendas são agrupadas por UTM. Investimento por campanha é mostrado separadamente pelo ID retornado pela Meta; o sistema não cruza nomes arbitrários para inventar ROAS por campanha.

## Validação local

Node.js 24 ou superior: node --test tests/dashboard-cakto.test.mjs

Contrato oficial consultado: https://docs.cakto.com.br/conceitos/webhooks

## Anúncios ativos e funil

A sincronização Meta agora importa os anúncios, campanhas, conjuntos, effective_status e miniaturas; os insights são no nível anúncio/dia e usam inline_link_clicks (cliques no link). O botão Sincronizar Meta autentica com a chave da sessão do painel e não expõe o token da Meta. O cron anterior continua aceitando x-sync-secret. As tabelas da migração 0016 são provisionadas automaticamente, sem SQL manual.

Os snapshots são publicados em uma transação: uma falha da Meta conserva os dados anteriores. Os totais antigos de campanha são substituídos no período sincronizado por totais de anúncio, para não dobrar o gasto. Anúncios ativos sem gasto também aparecem. ACTIVE não garante entrega; a tabela informa se houve impressões no período. Cliques, gastos e status só aparecem após configuração de META_ADS_ACCESS_TOKEN (ads_read + acesso à conta), META_ADS_ACCOUNT_ID e sincronização.

Código no campo Parâmetros de URL de cada anúncio, sem ponto de interrogação:

utm_source={{site_source_name}}&utm_medium=paid&utm_campaign={{campaign.id}}&utm_content={{ad.id}}&utm_term={{adset.id}}

As UTMs usam IDs para relacionar compra/visita ao anúncio. Nomes aparecem pelo inventário Meta. Vendas antigas que tinham nomes nas UTMs continuam no histórico e não recebem atribuição automática por aproximação de texto.

O site envia page_view e checkout_click para /api/collect com um ID aleatório de sessão, sem email, telefone, IP armazenado ou URL completa. A sessão dura até 30 minutos desde a criação e é renovada ao mudar as UTMs. Cada etapa conta uma vez por sessão e origem. O checkout é um clique no link da Cakto, não confirmação de carregamento no domínio dela. Cliques vêm da conta Meta, visitas/checkouts dos sites instrumentados, e vendas são pedidos aprovados; as bases não equivalem a uma mesma coorte de pessoas.

Origem autorizada por padrão: https://licores-por-encomenda.ivan-fts007.chatgpt.site e a própria origem do Pages. Para usar o HTML em outro domínio (por exemplo Vercel), adicione TRACKING_ALLOWED_ORIGINS em Produção com as origens HTTPS exatas, separadas por vírgula, e refaça a implantação. A medição começa após a publicação do script; não reconstitui visitas antigas.
