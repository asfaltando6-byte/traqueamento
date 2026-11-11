# Central Meta Ads

A central em `/dash/` acompanha vários sites e produtos e conecta somente Meta Ads como plataforma de anúncios. Não é uma reprodução integral do sistema privado da UTMify.

## Configuração pelo painel

1. Em **Integrações**, conecte um token Meta com `ads_read`. O servidor valida as contas realmente acessíveis antes de salvar. Escolha a conta e sincronize. A seleção atual usa uma conta por vez; não soma várias contas simultaneamente. Ao trocar de conta, sincronize novamente antes de visualizar seu investimento.
2. Para login pelo Facebook, crie/configure seu próprio aplicativo Meta e as permissões necessárias. Na seção expansível da central, salve App ID, App Secret e, quando aplicável, Config ID do Facebook Login for Business. Registre na Meta a URI de callback exibida. Só então use **Conectar com Facebook** e autorize sua conta. O código não cria nem aprova um aplicativo Meta por você. Autorizações expiram e podem exigir reconexão.
3. Em **Sites e produtos**, registre cada origem HTTPS e os domínios dos checkouts. Instale o script individual gerado uma única vez em cada site. Substitua um script antigo desta central para evitar dois coletores na mesma página. Site desativado deixa de enviar novos eventos.
4. Em **UTMs e códigos**, copie o modelo para **Parâmetros de URL** de cada anúncio Meta. Ele usa os IDs de campanha, conjunto e anúncio para cruzar os resultados. O código de cada site preserva as UTMs nos links de checkout cadastrados.
5. Em **Integrações**, cadastre uma ou mais conexões Cakto com a chave secreta do webhook. Copie a URL gerada para a Cakto e habilite `purchase_approved` para os produtos desejados. Os produtos são reconhecidos nas vendas recebidas, sem fixação em uma oferta específica.

A primeira instalação ainda precisa de `DB` associado ao D1 e `DASH_KEY` no Cloudflare. Configurações anteriores por variáveis de ambiente continuam disponíveis. As novas tabelas são criadas automaticamente de forma idempotente; a migração `0017_workspace_settings.sql` também registra o esquema.

## Dados e limites

- Anúncios ativos são importados da API Meta, inclusive os que não têm gasto no período. Sincronização manual pelo painel e cron existente permanecem disponíveis.
- Cliques são cliques no link informados pela Meta. Página de vendas e checkout contam sessões de todos os sites cadastrados e origens, não apenas pessoas atribuídas à Meta. Checkout significa clique de saída, não confirmação de carregamento do checkout.
- Vendas aprovadas e faturamento usam pedidos aprovados recebidos. Receita, resultado e ROI apresentados são **brutos**: não descontam taxas, impostos, chargebacks ou reembolsos. Não há uma etapa de vendas pendentes no funil atual.
- A integração Cakto atual não envia Purchase para a API de Conversões da Meta. Os conectores legados de outras plataformas de pagamento não passam a ter suporte completo por causa desta tela.
- Produtos podem aparecer com vendas históricas; a lista de produtos recebidos é geral. O período do resumo continua filtrando as métricas do resumo.

## Segredos

Tokens e chaves de conexões são criptografados no D1 com AES-GCM; o painel não os devolve ao navegador depois de salvos. A chave deriva de `INTEGRATION_ENCRYPTION_KEY`, quando definida, ou de `DASH_KEY`. Defina uma chave de criptografia estável antes de cadastrar integrações se pretende rotacionar `DASH_KEY` independentemente. Trocar a chave usada para criptografia exige cadastrar novamente as credenciais salvas; não há migração automática de chaves.

O login usa estado aleatório com expiração de dez minutos, uso único e vínculo a cookie HttpOnly. A sincronização e as configurações exigem autenticação do painel. URLs públicas dos coletores e webhooks não substituem a validação de origem/segredo.

## Verificação

`node --test tests/*.test.mjs`: autenticação, cadastro de múltiplos sites, coleta, isolamento e criptografia de segredos, múltiplos produtos Cakto, validação Meta, proteção de estado OAuth, sincronização e cálculos existentes. O login Meta real exige aplicativo e autorização do titular; testes locais não equivalem à aprovação da Meta.
