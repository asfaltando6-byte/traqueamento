# Minerador de ofertas — biblioteca de pesquisa

Referências de experiência: pesquisa e filtros do AdSpy, organização em swipe file do Swipekit e acompanhamento histórico do Foreplay/Spyder. Não é clone desses serviços e não inclui acesso aos bancos de dados deles.

## Disponível

- Cadastro manual de anúncios da Biblioteca Meta, nos países BR e US.
- Importação de JSON canônico, até 200 registros por lote e 1 MB; exportação dos registros, notas e favoritos.
- Filtros locais por país, dias desde o início, status, formato, palavra-chave e pasta.
- Agrupamento pela URL HTTPS de destino sem UTMs, fbclid, gclid, src e sck. Caminhos e parâmetros restantes são preservados para evitar misturar IDs de produtos de checkouts.
- Favoritos, pastas e notas persistidos no D1. O país é evidência declarada no cadastro e não é inferido pelo idioma.
- ID de anúncio + país como chave de registro. O mesmo anúncio encontrado em BR e US conta como um anúncio único nos totais da oferta. O histórico armazena observações de status. A interface exibe primeira observação e última verificação, sem afirmar atividade contínua entre elas.
- Datas inválidas, futuras, URLs sem HTTPS e países fora de BR/US são recusados. Importações são transacionais e não substituem evidências mais recentes por antigas.
- Status informado há mais de sete dias é exibido como não confirmado. Dias desde a data de início são diferentes de dias de entrega contínua comprovada.

## O que falta para mineração automática

A API `/api/miner` indica explicitamente `automatic_search:false`. Não há varredura automática da Biblioteca, acompanhamento em segundo plano, download de mídia, banco global, pontuação de escala, faturamento ou ROAS de concorrentes. O conteúdo dos anúncios é texto cadastrado; os criativos originais podem ser vistos através dos links para a Biblioteca.

É necessário contratar ou autorizar uma fonte de dados com cobertura comercial real para BR e US, verificar qualidade dos campos e conectar sua API no servidor. Foreplay publica APIs Discovery, Spyder e Swipe File em https://www.foreplay.co/api; Swipekit documenta acesso ao conteúdo já salvo no workspace, que não equivale a busca global, em https://swipekit.app/api. Nenhuma assinatura foi contratada ou chave de terceiros configurada nesta implementação.

A importação recebe os campos do modelo gerado no painel. `verified_at` é Unix em segundos; omitido ou zero indica uma verificação manual agora. Um registro exportado conserva seu timestamp ao ser reimportado. Organização acompanha a exportação como backup; o importador atual importa apenas anúncios, sem restaurar organização.

`0018_offer_miner.sql` registra o esquema, também criado idempotentemente nas funções. Todas as operações exigem DASH_KEY. A consulta atual retorna até 5.000 anúncios mais recentemente verificados; uma base maior exige paginação.

## Testes

`node --test tests/*.test.mjs`: agrupamento, separação de ofertas por ID, contagem entre países, evidências desatualizadas, validação, autenticação, atomicidade, deduplicação e favoritos, além dos testes anteriores do rastreamento. Fluxo de cadastro e favoritos verificado no navegador com base local e dados de teste, sem gravar dados artificiais em produção.
