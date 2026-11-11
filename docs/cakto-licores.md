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
