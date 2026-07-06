# SEO, AEO e descoberta por IA - inicio operacional

Data: 2026-07-06
Projeto: Guilherme Pilger - https://guilhermepilger.ai

## O que foi iniciado

- Criada a pagina evergreen `/guias/imoveis-luxo-litoral-catarinense`.
- Incluida a nova pagina no `sitemap.xml`.
- Adicionado link interno no rodape para a pagina-guia.
- Criado `public/llms.txt` como indice publico auxiliar para assistentes e crawlers.
- Criado o arquivo de chave IndexNow `public/cb1faa31259c49d2a40945fee50acd51.txt`.
- Criado o comando `npm run seo:indexnow -- <url>` para envio manual de URLs ao IndexNow apos o deploy da chave.

## Prioridade tecnica

1. Confirmar Google Search Console para `https://guilhermepilger.ai` ou `sc-domain:guilhermepilger.ai`.
2. Enviar `https://guilhermepilger.ai/sitemap.xml` no Search Console.
3. Confirmar Bing Webmaster Tools e importar/verificar o sitemap.
4. Configurar IndexNow com chave hospedada no dominio e automacao de envio quando imoveis, posts, noticias ou landings forem criados/atualizados.
5. Monitorar trafego de ChatGPT por `utm_source=chatgpt.com` em GA4/analytics.

## IndexNow

Chave atual:

```txt
cb1faa31259c49d2a40945fee50acd51
```

Arquivo publico esperado apos deploy:

```txt
https://guilhermepilger.ai/cb1faa31259c49d2a40945fee50acd51.txt
```

Envio manual de URL:

```bash
npm run seo:indexnow -- https://guilhermepilger.ai/guias/imoveis-luxo-litoral-catarinense
```

## Prioridade editorial

1. Revisar titulos de noticias e posts que ainda parecem gerados por prompt ou sem acentuacao.
2. Criar clusters de guias por cidade, bairro e intencao:
   - Balneario Camboriu frente mar.
   - Praia Brava casas e apartamentos de luxo.
   - Itapema lancamentos de alto padrao.
   - Porto Belo condominios e terrenos premium.
   - Coberturas, frente mar, casas de alto padrao e investimento.
3. Cada guia deve ter resposta direta, comparativo, FAQ, links internos e data de revisao.
4. Usar dados proprios de estoque, preco, liquidez e procura sempre que houver base confiavel.

## Medicao

- Consultas organicas por cidade, tipo de imovel e pergunta.
- Paginas com impressao sem clique no Search Console.
- Entradas em `/guias/*`, `/imoveis/*`, `/blog/*` e `/noticias/*`.
- Leads iniciados por pagina de guia.
- Referencias com `utm_source=chatgpt.com`.

## Regras

- Nao prometer valorizacao garantida.
- Nao usar texto oculto, keyword stuffing ou mencoes inautenticas.
- Nao criar pagina apenas para schema sem conteudo visivel.
- Separar fato, leitura de mercado e recomendacao.
- Manter estoque, disponibilidade e valores vinculados as paginas dinamicas.
