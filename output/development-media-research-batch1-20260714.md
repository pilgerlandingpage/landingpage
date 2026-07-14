# Pesquisa web - lote 1 de midia/copy dos empreendimentos

Gerado em: 2026-07-14

## Escopo

Primeiro lote baseado no topo P0 do arquivo `output/development-media-copy-audit-20260714.md`.

P0 significa que a pagina publica do empreendimento esta usando hero igual a imagem de unidade ou galeria majoritariamente formada por imagens dos apartamentos/casas.

## Achados gerais do lote

- `vivapark-porto-belo` e `vivapark` parecem representar o mesmo masterplan/bairro-parque. Antes de aplicar correcao definitiva, tratar como possivel duplicidade/canonicalizacao ou aplicar a mesma curadoria de masterplan nos dois slugs.
- As fotos atuais desses slugs vieram de `properties/imported/...`, ou seja, estao herdando midia de unidade.
- Para aplicar no Supabase, gravar as fotos do empreendimento em `content.custom_hero_image`, `content.custom_gallery`, `content.development.heroImage`, `content.development.hero_image` e `content.development.gallery`.
- Manter fotos internas dos apartamentos apenas em `content.development.units[].image/images`.

## 1. VivaPark Porto Belo

Slugs impactados:

- `vivapark-porto-belo`
- `vivapark`

Fontes verificadas:

- Vokkan: https://vokkan.com.br/empreendimento/vivapark-porto-belo/pt
- JA8 Arquitetura Viva: https://www.ja8.com.br/projeto/viva-park-porto-belo/

Informacoes confirmadas:

- Desenvolvido pela Vokkan.
- Descrito pela Vokkan como "o primeiro bairro parque do Brasil".
- Localizacao: Porto Belo/SC.
- Estrutura residencial integrada a educacao, trabalho, compras, lazer, cultura e bem-estar.
- A Vokkan cita 230 mil m2 de area verde, dois grandes parques com lagos, pistas integradas para caminhada e cinco pracas equipadas para esporte e lazer.
- Assinatura urbanistica de Jaime Lerner.
- A JA8 descreve o VivaPark como projeto baseado no Novo Urbanismo, com ecossistema tecnologico, seguro e sustentavel, realizado pela Vokkan, masterplan de Jaime Lerner Arquitetos Associados e 300 hectares.

Imagens candidatas:

- Hero masterplan/parque: https://vokkan.com.br/uploads/imagens/vivapark-porto-belo-fachada-754.webp
- Galeria: https://vokkan.com.br/uploads/imagens/vivapark-porto-belo-etapa-img-1-17.webp
- Galeria: https://vokkan.com.br/uploads/imagens/vivapark-porto-belo-etapa-img-3-311.webp
- Hero alternativo JA8: https://admin.ja8.com.br/uploads/project/28/66cf567cf20396.92322033.jpg
- Galeria JA8: https://admin.ja8.com.br/uploads/projectcontent/169/66cfa57239bd15.14209846.jpg
- Galeria JA8: https://admin.ja8.com.br/uploads/projectcontent/170/66cfa588785354.10360965.jpg
- Galeria JA8: https://admin.ja8.com.br/uploads/projectcontent/171/66cfa5a0afb654.67807818.jpg

Copy recomendada:

- Tratar como bairro planejado/masterplan, nao como um unico predio.
- Destacar parque, mobilidade a pe, ciclovias/caminhadas, areas verdes, lagos, pracas e infraestrutura urbana.
- Beneficios sugeridos: bairro-parque aberto, vida ao ar livre, planejamento urbano, infraestrutura completa, sustentabilidade, potencial de valorizacao em Porto Belo.

## 2. One Tower

Slug impactado:

- `one-tower`

Fonte verificada:

- One Tower: https://onetower.com.br/

Informacoes confirmadas:

- Empreendimento desenvolvido pela FG Empreendimentos.
- Localizado na Avenida Atlantica, 4954, Barra Sul, Balneario Camboriu/SC, em frente ao mar.
- A pagina informa 84 pavimentos e 290 metros de altura.
- Apartamentos tipo com 196,13 m2 privativos, 4 suites e 3 a 4 vagas.
- Lazer em mais de 4 pavimentos: piscinas, spa, sauna, academia, wine bar, salao de festas, espaco kids, minigolfe, pomar e piscina interna aquecida.
- Diferenciais citados: vista 360 para mar e cidade, fachada em pele de vidro, infraestrutura para automacao, acabamentos de alto padrao, gerador proprio para areas comuns e localizacao na Barra Sul.

Imagens candidatas:

- A pagina oficial possui imagens externas do One Tower, mas a extracao local por DNS/fetch falhou. O navegador web confirmou imagens "One Tower" na pagina.
- Proxima acao: baixar/espelhar manualmente via navegador ou usar imagem oficial depois de extrair `src` com ferramenta de browser/Playwright.

Copy recomendada:

- Posicionar como icone residencial frente-mar da Barra Sul, com arquitetura em vidro, altura de referencia e lazer vertical.
- Evitar texto generico de "unidades ativas"; a disponibilidade das unidades entra em bloco separado.

## 3. VivaPark

Slug impactado:

- `vivapark`

Observacao:

- Mesma pesquisa do VivaPark Porto Belo.
- O slug aparece separado porque o banco tem `source_condominium_name = VivaPark`, enquanto `vivapark-porto-belo` tem `source_condominium_name = VivaPark Porto Belo`.
- Recomendacao: tratar como duplicidade ou pagina canonicamente equivalente antes de aplicar textos divergentes.

## 4. Yachthouse by Pininfarina

Slug impactado:

- `yachthouse-by-pininfarina`

Fontes verificadas:

- Yachthouse: https://yachthouse.net.br/
- Yachthouse Pininfarina: https://yachthousepininfarina.com.br/

Informacoes confirmadas:

- Localizado na Barra Sul, Balneario Camboriu.
- Desenvolvido pela Pasqualotto & GT com design assinado pela Pininfarina.
- Duas torres com 81 pavimentos.
- A fonte consultada cita 264 unidades e plantas de aproximadamente 265 m2 privativos, com 4 suites, hall privativo e ate 3 vagas.
- Lazer com piscinas, spa, saunas, academia, espacos gourmet, cinema, brinquedoteca, saloes de festas e areas de convivencia.
- Fonte alternativa cita 294 m de altura, 81 pavimentos, 2 torres e apartamentos de 265 a 1.060 m2.

Imagens candidatas:

- Hero fachada: https://yachthousepininfarina.com.br/imgs/fachada/fachada-01.jpg
- Galeria fachada: https://yachthousepininfarina.com.br/imgs/fachada/fachada-03.jpg
- Galeria fachada: https://yachthousepininfarina.com.br/imgs/fachada/fachada-06.jpg
- Galeria fachada: https://yachthousepininfarina.com.br/imgs/fachada/fachada-10.jpg
- Galeria lazer: https://yachthousepininfarina.com.br/imgs/lazer/lazer-22.jpg
- Galeria lazer: https://yachthousepininfarina.com.br/imgs/lazer/lazer-95.jpg
- Galeria lazer: https://yachthousepininfarina.com.br/imgs/lazer/lazer-68.jpg
- Galeria lazer: https://yachthousepininfarina.com.br/imgs/lazer/lazer-19.jpg

Copy recomendada:

- Posicionar como complexo residencial iconico de duas torres na Barra Sul, com assinatura Pininfarina, escala vertical, marina/mar como contexto e lazer de alto padrao.
- Beneficios sugeridos: arquitetura assinada, duas torres, privacidade por hall/elevadores, lazer completo, vistas para mar/marina e localizacao Barra Sul.

## 5. Vitra by Pininfarina

Slug impactado:

- `vitra-by-pininfarina`

Fonte verificada:

- Vitra by Pininfarina: https://vitrabypininfarinabc.com.br/

Informacoes confirmadas:

- Empreendimento em Balneario Camboriu.
- A pagina descreve o Vitra como um novo marco de design e luxo.
- A fonte informa 180 metros do mar, apartamentos a partir de 172 m2, 4 suites e 3 vagas.
- A arquitetura combina area comercial e residencial; a base tem grandes paredes de vidro.
- A pagina destaca tres lados frontais, iluminacao e ventilacao naturais.
- Diferenciais do empreendimento: gerador para infraestrutura, fachada com pele de vidro, hall mobiliado e climatizado, entrada de servico e banhistas, sistema de seguranca, box de praia individual, 3 elevadores, captacao de agua de chuva, escada pressurizada, guarita e bicicletario.

Imagens candidatas:

- Hero foto real/fachada: https://vitrabypininfarinabc.com.br/wp-content/uploads/2024/05/20240229_132112348_iOS-696x1024.jpg
- Hero render/fachada: https://vitrabypininfarinabc.com.br/wp-content/uploads/2024/05/44-A.jpg

Copy recomendada:

- Posicionar como torre de design com assinatura Pininfarina, base comercial envidracada, proximidade do mar e solucao de planta com ventilacao/iluminacao.
- Beneficios sugeridos: design assinado, 180 m do mar, fachada em pele de vidro, rooftop/lazer, seguranca e infraestrutura de alto padrao.

## 6. Boreal Tower

Slug impactado:

- `boreal-tower`

Fontes verificadas:

- Boreal Tower: https://borealtower.com.br/
- Skyscraper Center: https://www.skyscrapercenter.com/building/boreal-tower/16118
- Noticenter: https://www.noticenter.com.br/n.php?ID=40247&T=fg-empreendimentos-entrega-o-boreal-tower-um-dos-edificios-mais-modernos-e-inovadores-do-pais

Informacoes confirmadas:

- Fonte do empreendimento descreve arquitetura inspirada na flor de lotus.
- A pagina do Boreal cita tres andares de area de lazer.
- Skyscraper Center identifica o empreendimento como Boreal Tower em Balneario Camboriu e atribui credito a FG Empreendimentos.
- Noticenter informa que o Boreal Tower foi entregue pela FG Empreendimentos, tem 241 metros de altura e combina solucoes estruturais inovadoras, eficiencia energetica, conforto e sustentabilidade.

Imagens candidatas:

- A pagina oficial possui imagens do empreendimento, mas a extracao local por DNS/fetch ainda precisa ser feita por navegador/browser para obter URLs estaveis.

Copy recomendada:

- Posicionar como torre frente-mar/alto padrao da FG, com linguagem arquitetonica inspirada na flor de lotus, escala vertical, lazer distribuido em tres andares e tecnologia/eficiencia.

## Proxima acao de aplicacao

1. Resolver duplicidade/canonicalizacao de `vivapark` vs `vivapark-porto-belo`.
2. Extrair URLs finais de One Tower e Boreal via browser quando o DNS local permitir ou usando ferramenta de navegador.
3. Aplicar primeiro apenas em `vivapark-porto-belo`, `vivapark`, `yachthouse-by-pininfarina` e `vitra-by-pininfarina`, porque ja ha URLs de imagem candidatas estaveis.
4. Rodar novamente `node scripts/audit-development-media-copy.mjs --slugs=vivapark-porto-belo,vivapark,yachthouse-by-pininfarina,vitra-by-pininfarina`.
5. Conferir que `hero_matches_unit_image = no` e `active_gallery_unit_matches = 0`.
