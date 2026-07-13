# Auditoria 8F - Contexto de empreendimento nos imoveis

Gerado em: 2026-07-13T13:05:53.245Z

## Resumo

- Imoveis ativos: 1063
- Landings publicadas analisadas: 789
- Imoveis com contexto por unidade direta: 968
- Imoveis cobertos pelo fallback de nome: 24
- Imoveis ainda sem contexto: 71

## Leitura dos 71 restantes

- Sem condominio claro ou imovel avulso: 22
- Localizacao/endereco, nao empreendimento: 34
- Precisa criar landing: 8
- Precisa revisar alias ou confirmar landing existente: 5
- Revisao manual: 2

## Acao recomendada

Priorizar os 15 casos acionaveis: 8 novas landings, 5 revisoes de alias/landing e 2 revisoes manuais. Os outros 56 nao devem receber bloco automatico ate haver dado de condominio confirmado.

## Precisa criar landing

| Ref | Imovel | Slug | Landing proxima | Acao |
| --- | --- | --- | --- | --- |
| 2034 | Galpão Logístico no Smart Valley | galpao-logistico-no-smart-valley | - | Criar landing de empreendimento/condominio ou marcar como excecao se for imovel avulso. |
| 2134 | Apartamento no Condomínio Dona Lely em Itapema | apartamento-no-condominio-dona-lely-em-itapema | - | Criar landing de empreendimento/condominio ou marcar como excecao se for imovel avulso. |
| 2217 | Sala Comercial no Edifício Riviera Business & Mall | sala-comercial-no-edificio-riviera-business-mall | - | Criar landing de empreendimento/condominio ou marcar como excecao se for imovel avulso. |
| 2343 | Pré Lançamento Ed. Aura na Praia Brava em Itajaí | pre-lancamento-ed-aura-na-praia-brava-em-itajai | - | Criar landing de empreendimento/condominio ou marcar como excecao se for imovel avulso. |
| 2396 | Condomínio Logístico  Garuva/SC | galpao-logistico-no-smart-valley | - | Criar landing de empreendimento/condominio ou marcar como excecao se for imovel avulso. |
| 2397 | Condomínio Logístico AAA  Navegantes/SC | galpao-logistico-no-smart-valley | - | Criar landing de empreendimento/condominio ou marcar como excecao se for imovel avulso. |
| 2635 | Terreno em Condomínio Logístico em Campo Grande - MS | terreno-em-condominio-logistico-em-campo-grande-ms | - | Criar landing de empreendimento/condominio ou marcar como excecao se for imovel avulso. |
| 2638 | Galpão em Condomínio Logístico e Industrial Nextto em Navegantes/SC | galpao-em-condominio-logistico-e-industrial-nextto-em-navegantessc | - | Criar landing de empreendimento/condominio ou marcar como excecao se for imovel avulso. |

## Precisa revisar alias ou landing existente

| Ref | Imovel | Slug | Landing proxima | Acao |
| --- | --- | --- | --- | --- |
| 2035 | Galpão Logístico no Valley Business Park | galpao-logistico-no-valley-business-park | cond-hub-camboriu-business-park | Revisar alias/nome da landing mais parecida; se nao for o mesmo empreendimento, criar landing propria. |
| 2057 | Casa no Condomínio Caledônia Village em Camboriú/SC | casa-no-condominio-caledonia-village-em-camboriusc | condominio-caledonia | Revisar alias/nome da landing mais parecida; se nao for o mesmo empreendimento, criar landing propria. |
| 2182 | Casa no Condomínio Brava Horizontal na Praia Brava em Itajaí | casa-no-condominio-brava-horizontal-na-praia-brava-em-itajai | condominio-horizontal-praia-brava | Revisar alias/nome da landing mais parecida; se nao for o mesmo empreendimento, criar landing propria. |
| 2188 | Terreno no Condomínio All Resort Porto Belo | terreno-no-condominio-all-resort-porto-belo | condominio-ponta-do-estaleiro | Revisar alias/nome da landing mais parecida; se nao for o mesmo empreendimento, criar landing propria. |
| 2201 | Casa no Condomínio Reserva Camboriú Golf Club | casa-no-condominio-reserva-camboriu-golf-club | condominio-reserva-camboriu-yacht-golf | Revisar alias/nome da landing mais parecida; se nao for o mesmo empreendimento, criar landing propria. |

## Revisao manual

| Ref | Imovel | Slug | Landing proxima | Acao |
| --- | --- | --- | --- | --- |
| 2038 | Galpão Logístico na BR470-2 | galpao-logistico-no-trevo-luiz-alvez | - | Revisar manualmente: existe nome extraido, mas ele nao parece claramente empreendimento. |
| 2441 | Galpão Logístico/Industrial na Penha - SC | galpao-logisticoindustrial-na-penha-sc | - | Revisar manualmente: existe nome extraido, mas ele nao parece claramente empreendimento. |

## Excecoes por enquanto

Os grupos likely_no_condominium e location_or_address_only foram mantidos fora da acao automatica porque indicam casa, terreno, praia, rodovia, bairro, cidade ou endereco, nao um empreendimento confirmado.
