# Plano atualizado das etapas restantes - Zillow/Pilger

Atualizado em: 18/06/2026

Status pos-implementacao: etapas 1 a 9 executadas sem SQL novo. As melhorias foram feitas reaproveitando `funnel_events`, `leads.metadata.behavior_summary`, alertas salvos, recomendacoes do CRM, briefing executivo, favoritos locais, historico recente e regioes estaticas do mapa.

## Objetivo deste documento

Este documento substitui o plano amplo anterior e registra apenas as etapas que ainda faltam terminar.

A auditoria mostrou que varias etapas que pareciam exigir novas estruturas ja possuem base no projeto. Portanto, o plano restante foi atualizado para evitar duplicidade e preservar os dados que os agentes ja usam.

## Regra de execucao daqui para frente

1. Reaproveitar primeiro o que ja existe.
2. Nao criar tabela nova se `funnel_events`, `leads.metadata`, `appointments`, `property_search_alerts` ou `property_price_history` ja resolverem.
3. So parar para pedir SQL quando a etapa realmente exigir uma nova estrutura.
4. Todo novo sinal comercial precisa alimentar o CRM e os agentes, nao apenas a interface.
5. Nenhuma etapa deve reintroduzir informacoes de financiamento.

## O que ja pode ser considerado entregue

Estas partes do plano Zillow/Pilger ja existem ou ja foram implementadas em fases anteriores:

- Busca por mapa com pins, clusters, card de preview e filtros.
- Busca por area desenhada no mapa.
- Query params para area desenhada, bounds e imovel selecionado.
- Busca server-side por poligono via PostGIS.
- Alertas salvos de busca.
- Matches de alertas com imoveis compativeis.
- Painel de alertas salvos.
- Historico de preco e leitura de valor na pagina do imovel.
- Street View, mapa e satelite na pagina do imovel.
- Favoritos e historico recente no navegador.
- Eventos de favoritos e historico no rastreamento.
- CRM lendo `behavior_summary`.
- Recomendacoes comerciais para alertas salvos.
- Briefing executivo do lead.
- Agenda real com disponibilidade de corretor, bloqueios e visitas.
- Remocao da camada publica de financiamento/simulador.

## Etapa restante 1 - Consolidar intencoes premium no rastreamento

Status: concluida no ciclo atual.

Problema:
As novas intencoes comerciais de alto padrao ainda nao estao totalmente modeladas no rastreamento como sinais fortes para CRM e agentes.

Reaproveitar:

- `/api/track`
- `funnel_events`
- `lib/tracking/client.ts`
- `lib/tracking/lead-activity.ts`
- `leads.metadata.behavior_summary`

Implementar:

- Adicionar eventos:
  - `property_private_visit_requested`
  - `property_availability_requested`
  - `property_reserved_negotiation_requested`
  - `property_value_reading_requested`
- Fazer esses eventos entrarem em:
  - `event_counts`
  - `intent_signals`
  - `engagement_score`
  - `next_best_action`
  - historico do CRM

SQL: nao precisa.

Observacao:
Esta deve ser a proxima etapa tecnica, porque todas as outras dependem desses sinais.

## Etapa restante 2 - Atualizar CTAs da pagina do imovel para alimentar esses sinais

Status: concluida no ciclo atual.

Problema:
A pagina ja tem CTAs de disponibilidade, leitura de valor, contato e visita privada, mas eles ainda precisam ficar padronizados como intencoes premium rastreaveis.

Reaproveitar:

- `WhatsAppCaptureLink`
- `WhatsAppLeadCaptureModal`
- `/api/leads/capture`
- `PropertyLandingTracker`
- CTAs atuais da pagina interna.

Implementar:

- Padronizar os CTAs:
  - Solicitar disponibilidade.
  - Solicitar visita privada.
  - Solicitar negociacao reservada.
  - Receber leitura de valor.
- Enviar no metadata:
  - `premium_intent`
  - `requested_action`
  - `property_id`
  - `property_url`
  - `property_title`
  - `cta_context`
- Disparar o evento correto antes ou durante a captura do lead.

SQL: nao precisa.

Observacao:
O `/api/leads/capture` ja reanexa o historico anonimo ao lead identificado, entao nao devemos criar outro fluxo de lead.

## Etapa restante 3 - Mostrar intencoes premium no CRM

Status: concluida no ciclo atual.

Problema:
O CRM ja mostra score, sinais, historico e recomendacoes, mas ainda nao destaca as novas intencoes de alto padrao como categoria propria.

Reaproveitar:

- `app/api/admin/leads/crm/route.ts`
- `app/admin/leads/crm/page.tsx`
- `behavior_summary`
- `site_activity`

Implementar:

- Exibir no card/detalhe do lead:
  - pediu visita privada;
  - pediu disponibilidade;
  - pediu negociacao reservada;
  - pediu leitura de valor;
  - favoritou e voltou ao mesmo imovel;
  - abriu Street View;
  - salvou busca e abriu match.
- Criar filtro visual ou destaque para "intencao premium".
- Ajustar textos para equipe comercial de alto padrao.

SQL: nao precisa.

## Etapa restante 4 - Adaptar recomendacoes dos agentes para as novas intencoes

Status: concluida no ciclo atual.

Problema:
As recomendacoes comerciais ja existem, mas hoje estao muito focadas em alerta salvo e follow-up. Precisam incorporar os sinais premium.

Reaproveitar:

- `lib/leads/crm-action-recommendations.ts`
- `lib/leads/lead-executive-briefs.ts`
- `crm_action_recommendations`
- `crm_executive_brief`

Implementar:

- Criar recomendacoes como:
  - "Lead pediu visita privada e ainda nao houve confirmacao."
  - "Lead pediu disponibilidade deste imovel."
  - "Lead pediu negociacao reservada."
  - "Lead analisou valor e abriu contato."
  - "Lead favoritou e revisitou o mesmo imovel."
  - "Lead abriu Street View antes de pedir atendimento."
- Inserir essas recomendacoes no briefing executivo.
- Fazer `next_best_action` priorizar esses sinais antes de interesses fracos.

SQL: nao precisa.

## Etapa restante 5 - Conectar visita privada com a agenda existente

Status: concluida no ciclo atual.

Problema:
A agenda ja existe, mas o pedido publico de visita privada ainda precisa se conectar melhor com o fluxo comercial.

Reaproveitar:

- `appointments`
- `broker_weekly_availability`
- `broker_schedule_blocks`
- `app/api/admin/whatsapp/appointments/route.ts`
- deteccao de agendamento no agente WhatsApp

Implementar:

- Se o cliente so pedir visita sem data:
  - registrar como evento premium no lead;
  - gerar recomendacao no CRM;
  - nao criar appointment ainda.
- Se houver data/hora:
  - criar ou reaproveitar `appointments`;
  - usar status `pendente_disponibilidade` quando precisar confirmar;
  - incluir contexto do imovel em `appointments.metadata`.

SQL: nao precisa no primeiro ciclo.

SQL opcional:
Somente se quisermos campo tipado `property_id` em `appointments`. Por enquanto, usar `metadata` evita migracao desnecessaria.

## Etapa restante 6 - Fortalecer favoritos como sinal para agentes

Status: concluida no ciclo atual.

Problema:
Favoritos ja existem no navegador e no tracking, mas ainda precisam virar melhor inteligencia comercial para os agentes.

Reaproveitar:

- `pilger_property_favorites`
- `pilger_property_history`
- `property_favorited`
- `property_unfavorited`
- `PropertyContinuationRail`
- `FavoritePropertiesClient`
- `behavior_summary.liked_property_ids`

Implementar:

- Exibir no CRM os imoveis favoritos e revisitados com mais clareza.
- Gerar recomendacao quando:
  - lead favoritou imovel;
  - lead revisitou favorito;
  - lead comparou favoritos;
  - lead abriu favoritos e depois pediu contato.
- Usar favoritos para enriquecer alertas e sugestoes.

SQL: nao precisa agora.

SQL opcional:
Criar tabela de favoritos server-side apenas se a empresa decidir sincronizar favoritos entre dispositivos antes do lead estar identificado.

## Etapa restante 7 - Melhorar alertas salvos e matches como follow-up comercial

Status: concluida no ciclo atual, com refinamento continuo de linguagem e criterios.

Problema:
Alertas salvos, matches e follow-ups ja existem. O que falta e refinar o uso comercial para alto padrao.

Reaproveitar:

- `property_search_alerts`
- `property_search_alert_matches`
- `SearchAlertsPanel`
- `search-alert-matcher.ts`
- cron de alertas
- recomendacoes do CRM

Implementar:

- Ajustar linguagem das mensagens sugeridas para mercado acima de R$ 4 milhoes.
- Priorizar match por:
  - regiao desenhada;
  - historico de favoritos;
  - imoveis revisitados;
  - leitura de valor;
  - abertura de Street View;
  - faixa de preco premium.
- Gerar recomendacao quando o lead abrir match e nao houver abordagem.

SQL: nao precisa.

## Etapa restante 8 - Refinar regioes e poligonos oficiais

Status: concluida no ciclo atual, com refinamento continuo dos limites oficiais.

Problema:
O mapa ja tem poligonos estaticos e busca por area, mas ainda podemos melhorar a qualidade dos limites e labels.

Reaproveitar:

- `lib/locations/map-regions.ts`
- `search_active_properties_in_area`
- `drawArea`
- `mapBounds`
- `selected_region`

Implementar:

- Revisar poligonos de:
  - Praia Brava;
  - Balneario Camboriu;
  - Itapema;
  - Porto Belo;
  - Camboriu;
  - Bombinhas;
  - Navegantes;
  - Penha.
- Padronizar nomes e aliases.
- Garantir que a regiao selecionada alimente:
  - URL;
  - alerta salvo;
  - CRM;
  - agentes;
  - `behavior_summary.selected_regions`.

SQL: nao precisa agora.

SQL opcional:
Somente se quisermos cadastrar/editar regioes pelo painel admin.

## Etapa restante 9 - Dashboard executivo derivado do que ja existe

Status: concluida no ciclo atual dentro do CRM existente.

Problema:
Temos varios dados, mas ainda falta um painel executivo simples para acompanhar a evolucao Zillow/Pilger.

Reaproveitar:

- `funnel_events`
- `leads.metadata.behavior_summary`
- `property_search_alerts`
- `property_search_alert_matches`
- `appointments`
- CRM atual

Implementar metricas:

- Leads com intencao premium.
- Pedidos de visita privada.
- Pedidos de disponibilidade.
- Pedidos de negociacao reservada.
- Pedidos de leitura de valor.
- Imoveis mais favoritados.
- Imoveis mais revisitados.
- Regioes mais desenhadas.
- Alertas salvos ativos.
- Matches abertos sem abordagem.
- Visitas pendentes de disponibilidade.

SQL: nao precisa no primeiro ciclo.

SQL opcional:
Criar snapshots materializados apenas se a consulta ficar pesada.

## Ordem executada neste ciclo

1. Consolidar eventos premium no rastreamento.
2. Atualizar CTAs da pagina do imovel para disparar esses eventos.
3. Mostrar intencoes premium no CRM.
4. Adaptar recomendacoes e briefing dos agentes.
5. Conectar visita privada com agenda/workflows existentes sem SQL.
6. Fortalecer favoritos e revisitados como sinal comercial.
7. Refinar alertas salvos e matches com contexto de favoritos/historico.
8. Refinar regioes, aliases e poligonos estaticos.
9. Criar painel executivo derivado dentro do CRM atual.

## Quando devo parar para pedir SQL

Vou parar antes de seguir se alguma etapa exigir:

- favoritos server-side multi-dispositivo;
- tabela admin de regioes/poligonos;
- snapshots historicos regionais de valor;
- snapshots materializados para dashboard;
- coluna tipada `property_id` em `appointments`;
- qualquer nova tabela de solicitacao comercial.

Neste ciclo nenhuma etapa exigiu SQL novo.

## Proxima etapa recomendada

Proxima etapa recomendada:
validacao operacional com dados reais no Supabase, rodando a fila IA de recomendacoes, resumos executivos e alertas salvos pelo painel do CRM.
