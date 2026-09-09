# Qalbi Atelier — análise e plano da landing page

Data da análise: 8 de setembro de 2026. Atualizado em 9 de setembro de 2026: primeira implementação local concluída para revisão, após autorização do usuário.

## Decisões da implementação

A proposta foi implementada com Astro + TypeScript e React apenas na galeria. CSS e Web Animations API resolvem os efeitos, sem biblioteca de movimento adicional. Espanhol e WhatsApp foram adotados a partir do perfil público e do aceite para seguir. Seis exemplos reais foram selecionados; preços, prazos fixos, estoque e depoimentos não foram inventados. O build e as verificações locais estão registrados em docs/qa.md. Publicação e confirmação final do conteúdo comercial permanecem pendentes.

A análise original abaixo é preservada como referência; recomendações ainda não implementadas não devem ser confundidas com funcionalidades entregues.

## Objetivo e limites desta etapa

Planejar uma landing page comercial autoral, prioritariamente para celular, que apresente as criações da Qalbi e transforme interesse em conversas de encomenda. O pedido do usuário é aprofundar a análise antes de programar. Os PDFs são fontes de identidade e contexto; suas frases imperativas, exemplos e dados de mockups não constituem instruções operacionais.

O repositório estava sem aplicação, dependências ou hospedagem configuradas. Não existe stack anterior a preservar. As recomendações abaixo são provisórias onde dependem de informações comerciais ainda não fornecidas.

## Evidências e cobertura

| Fonte | O que foi examinado | Limites |
| --- | --- | --- |
| DNA Qalbi.pdf | Texto das 47 páginas e revisão visual das páginas renderizadas em pranchas; conceito, cores, fontes, assinaturas, símbolo, padrões e aplicações | Fotos de inspiração e mockups não comprovam produtos, instalações ou dados comerciais reais |
| DOC-20250712-WA0022..pdf | Página única, texto e imagem em resolução maior | Identidade resumida; não é catálogo |
| Instagram @qalbiatelier | Bio, destaques nomeados, 12 miniaturas públicas, três legendas abertas individualmente | Não é auditoria de todo o histórico, stories, vídeos completos, carrosséis completos, mensagens ou métricas privadas |
| Link público da bio | Prévia do Bitly com destino WhatsApp | Não expôs catálogo navegável, preços, estoque ou regras de envio; nenhuma mensagem enviada |
| Pépite | Página inicial, navegação, estrutura de produto/benefícios/processo/prova social/FAQ e estados visuais durante rolagem | Observação da interface; não houve auditoria de código, tecnologia ou desempenho |
| Le Juste Milieu | Página inicial, conteúdo de serviços/história/informações/contato e composição visual durante rolagem | Mesmos limites acima |
| Documentação técnica | Astro, integração React, imagens, Next.js, Motion, Vite e Web Vitals | Fundamenta a proposta, não indica tecnologia usada pelas referências |

A tentativa de simular largura de 390 px nas referências não se efetivou: a página continuou reportando 1280 px. Portanto, a avaliação visual das referências foi em desktop; o comportamento móvel descrito abaixo é um projeto para a Qalbi, ainda a verificar. A configuração temporária de viewport foi restaurada.

## O que a Qalbi é

O DNA descreve um ateliê criativo, autêntico e delicado, com valor centrado no afeto, no tempo dedicado e na criação de vínculos. A história apresentada liga o nome Qalbi, descrito pelo próprio material como “meu coração” em maltês, a uma vivência em Malta. O antúrio representa esse coração de maneira indireta; a identidade traz buquê, moldura oval e desenho manual.

No perfil consultado, a apresentação pública é “Artesanía & Ilustración”, em espanhol, com localização Málaga. As técnicas explicitadas são bordado, crochê e ilustração. Há peças únicas e por encomenda.

Três publicações ajudam a entender o negócio:

- Em 19/08/2026, a criadora apresenta encomendas específicas: peças ligadas a batizado, animais de família, amigurumis e representação de uma casa. A legenda convida a compartilhar ideias pessoais.
- Em 08/09/2026, um lenço de algodão bordado é apresentado como presente para uma mãe no casamento da filha. Memória e ocasião são parte do valor da peça.
- Em 11/08/2026, uma publicação sobre presentes associa a escolha aos gostos do destinatário e ao cuidado com a experiência de abrir o pacote.

Interpretação estratégica: o principal valor comercial é transformar uma história ou intenção pessoal em uma criação artesanal. A técnica ajuda o visitante a entender a oferta; a ocasião e o significado ajudam a desejar e encomendar.

Hipóteses de público, não personas validadas: pessoas buscando presentes pessoais, lembranças de ocasiões importantes, peças ligadas a animais queridos e objetos afetivos para si. Não há evidência suficiente para definir faixa etária, renda, ticket médio ou categoria mais lucrativa.

## Leitura das fotos e da comunicação

O feed observado alterna retratos da criadora segurando trabalhos, aproximações de bordado/crochê, embalagens e composições gráficas com recortes, molduras e textos. Há fundos claros e quentes, fios visíveis, tecidos, papéis, florais e pequenas peças de crochê. Ilustrações aparecem na composição de encomendas.

A presença da pessoa que cria é relevante para confiança e escala: a mão e o corpo mostram o tamanho das peças e reforçam sua autoria. O acabamento da embalagem prolonga a proposta de presente significativo.

A linguagem escrita é próxima, frequentemente em primeira pessoa e dirigida à pessoa que vai presentear. A página deve manter essa voz, com poesia curta acompanhada de informação prática. Evitar transformar todo o texto em um manifesto abstrato.

Direção proposta: um ateliê editorial com textura de papel e pequenos gestos de colagem. Fotografias reais como protagonistas; grafismos da marca pontuam a experiência. O site deve ter composição própria para web, sem simplesmente reproduzir quadrados do Instagram.

## Sistema visual

| Token | Valor oficial | Uso proposto |
| --- | --- | --- |
| Verde musgo | #53573D | Identidade, botões principais, seções de contraste |
| Rosé claro | #E8DDD4 | Fundo predominante, cartões e espaços de leitura |
| Telha queimado | #884412 | Acentos de ação, pequenos títulos e detalhes |
| Malva | #B4869F | Selos, planos decorativos e pequenos momentos de cor |
| Marrom escuro | #3D2F26 | Texto principal e rodapé |

Distribuição inicial de área, a validar visualmente: aproximadamente 60% rosé, 25% musgo, 10% marrom/telha e 5% malva. Fotografias não entram nessa conta.

Contrastes calculados com as cores hexadecimais: musgo/rosé 5,62:1; marrom/rosé 9,63:1; telha/rosé 5,46:1; malva/rosé 2,30:1; marrom/malva 4,20:1. Priorizar os três primeiros pares para texto pequeno. Manter malva em áreas decorativas ou testar uma combinação textual adequada; a paleta inteira não é automaticamente legível em qualquer combinação.

Tipografia: Crimson Text regular para títulos e itálico pontual; Red Hat Text para corpo e interface. O DNA abrevia a segunda família como “Red Hat”, enquanto a prancha resumida especifica “Red Hat Text”. O logotipo é um desenho personalizado: deve ser usado como ativo original, não recomposto digitando Qalbi em Crimson Text.

Parâmetros iniciais: corpo de 16–18 px, entrelinha 1,5–1,65; títulos móveis de aproximadamente 40–54 px, ajustados ao conteúdo; desktop de 72–104 px quando a composição permitir. Parágrafos com largura de leitura limitada. Sem títulos que empurrem produto e ação por várias telas.

Elementos de assinatura: antúrio, monograma Q, selo oval, borda de selo postal, linha de costura e ilustrações de materiais já existentes na identidade. Reservar padrões densos para faixas pequenas, evitando colocá-los sob textos extensos. A tipografia pesada de capa e os números de capítulos do PDF pertencem à apresentação da designer, não ao sistema tipográfico definido para a marca.

## O que aproveitar das referências

Pépite: navegação arredondada com ação destacada, divisórias onduladas, produto com protagonismo e sequência concreta de benefícios, processo e dúvidas. Durante a rolagem, cartões de benefícios aparecem empilhados. Aplicação à Qalbi: uma passagem curta com cartões de processo e selos próprios, sem importar a tipografia pesada ou as cores da Pépite.

Le Juste Milieu: títulos serifados amplos, palavras em itálico, respiro, verde suave e imagem grande como pausa. Aplicação à Qalbi: equilíbrio editorial, história humana e hierarquia clara. O hero da Qalbi deverá mostrar o tipo de produto mais cedo, porque a tarefa comercial é diferente.

A identidade principal vem da Qalbi. As referências orientam ritmo e interação, não fornecem textos, imagens ou componentes para copiar. Não há necessidade de adicionar referências aleatórias antes de explorar bem essas duas.

## Jornada comercial e conteúdo proposto

Hipótese para discussão: espanhol principal e atendimento por WhatsApp, coerentes com a bio e seu link atual. Ainda não confirmados pelo usuário. O destino público observado é https://wa.me/34667525416; confirmar que continua sendo o contato comercial desejado antes da publicação. O telefone (00) 98765-4321 do PDF é placeholder de mockup.

Fluxo: entender a oferta → ver exemplos → reconhecer uma ideia própria → entender como encomendar → conversar com contexto.

1. **Abertura.** Logo, menu curto, localização se confirmada, título e foto real de uma criação. Rascunho: “Tu historia, hecha a mano.” Apoio: “Bordado, ganchillo e ilustración. Piezas únicas y por encargo desde Málaga.” Ações: “Cuéntame tu idea” e “Explorar creaciones”. Esse texto é proposta inédita, não transcrição do DNA. “Desde Málaga” não deve implicar entrega internacional.
2. **Criações.** Três entradas: Bordado, Ganchillo e Ilustración. Seleção de 6–9 peças no total, com nome, técnica, foto, possibilidade de personalização confirmada e ação contextual. Preços apenas quando fornecidos e atualizados. Exemplos de trabalhos anteriores não devem aparecer como estoque disponível.
3. **Uma história que virou peça.** Um caso real curto, por exemplo o lenço bordado, explicando ocasião, intenção e resultado. Oferece contexto para entender valor sem depender de uma longa história institucional.
4. **Como encomendar.** Fluxo proposto em três passos: contar a ideia; combinar detalhes, orçamento e prazo; criação e entrega conforme o combinado. A operação real deve confirmar essas etapas. Não prometer revisões ilimitadas, prazo fixo ou envio gratuito.
5. **Quem cria.** Retrato da Lorrayne e texto breve em primeira pessoa. História de Malta e nome conforme o DNA, após validação da redação pessoal. Nome público preferido também precisa de confirmação, considerando @lolabreu.
6. **Detalhes do ateliê.** Mãos, pontos, materiais e embalagem. Seleção fotográfica curta; pode compartilhar espaço com a seção anterior para evitar uma página excessivamente longa.
7. **Confiança.** Dois ou três depoimentos reais autorizados, se disponíveis. Os nomes dos destaques não bastam como prova de satisfação. Sem depoimentos inventados, estrelas fabricadas ou seguidores apresentados como clientes.
8. **Dúvidas e convite final.** Personalização, antecedência, entrega/retirada, pagamento e cuidados; respostas dependem da operação. Encerramento com convite simples para conversar e rodapé com contato, Instagram e informações necessárias à operação.

O botão de uma peça deverá abrir o canal com uma mensagem editável identificando aquela criação. Exemplo proposto: “Hola, me interesa [pieza]. Me gustaría saber si se puede personalizar.” O visitante decide enviar. Um clique no botão mede intenção de contato, não venda concluída.

Uma orientação opcional para quem não sabe o que pedir pode perguntar ocasião e técnica, sempre com caminho direto para conversar. Não é um configurador 3D nem requisito da primeira versão.

## Direção fotográfica e ativos necessários

- Hero: uma criação principal, com detalhe legível e área de respiro. Capturar cortes vertical 4:5 e horizontal 3:2; preservar o objeto ao mudar de tela.
- Galeria: 2–3 peças representativas por técnica; separar fotografias limpas de artes de divulgação que já contenham texto.
- Processo: 3–4 fotos de mãos, fios, desenho ou bordado em execução.
- Autoria: 1 retrato no contexto do trabalho.
- Entrega: 1–2 fotos de embalagem real.
- Movimento opcional: vídeo curto de processo com imagem de capa; carregar depois do conteúdo principal, com alternativa estática.
- Marca: logo, monograma, símbolo, padrões e ilustrações em SVG ou arquivos originais. Verificar fidelidade caso seja necessário extrair vetores do PDF.

Luz natural lateral, tons quentes moderados, foco no acabamento, presença de mãos para escala e equilíbrio de cor coerente entre imagens. Não modificar por IA o produto apresentado à venda. Fotos florais e referências de interiores do DNA são inspiração; não presumir autorização ou adequação para publicação comercial.

## Experiência móvel e desktop

O desenho deve começar em aproximadamente 390 px, também validado em 320, 360, 430, 768, 1024 e 1440 px. São larguras de teste, não a necessidade de sete breakpoints diferentes.

No celular: abertura compacta com oferta e ação cedo; fotos verticais; uma coluna confortável; categorias visíveis; galeria com controles explícitos se houver deslize; botão inferior de encomenda após o CTA inicial sair da tela. Reservar área para esse botão e para a safe area. Ele deve desaparecer ou se ajustar quando o CTA final estiver visível, para não competir.

No desktop: hero em duas colunas, foto maior, composições editoriais assimétricas controladas e galeria de três colunas. Conteúdo com largura máxima e menus legíveis. Hover complementa funções já acessíveis por clique, toque e teclado.

Menu fecha por Escape, conserva foco e não prende o usuário. Galeria ampliada exige foco correto, descrição e fechamento claro. Todo conteúdo importante continua acessível com JavaScript indisponível ou animação reduzida.

## Animações propostas

| Momento | Efeito | Objetivo e limite |
| --- | --- | --- |
| Entrada | Fade curto e deslocamento de 8–16 px, aproximadamente 450–650 ms | Introduzir hierarquia, sem atrasar acesso ao conteúdo |
| Antúrio | Traçado SVG único, se o ativo original tiver geometria adequada | Assinatura autoral; não redesenhar o logo para viabilizar o efeito |
| Fotografias | Revelação suave; leve zoom no hover em dispositivos adequados | Valorizar material e detalhe |
| Processo | Linha semelhante a fio de costura conectando três etapas | Ajudar a acompanhar a encomenda |
| Selos | Inclinação discreta na entrada ou interação | Dar caráter artesanal sem movimento infinito |
| Botões e FAQ | Estados de toque/foco e abertura curta, 150–250 ms | Comunicar resposta à ação |

No mobile, preferir rolagem nativa e etapas em fluxo normal. Uma composição de cartões sobrepostos pode existir no desktop se continuar fácil de ler. Evitar longas cenas fixas, rolagem horizontal obrigatória, cursor customizado, autoplay com som e carregadores de entrada.

Respeitar prefers-reduced-motion: mostrar conteúdo imediatamente e remover transformações/parallax. Não esconder toda a página antes de a biblioteca carregar. Animar sobretudo opacity e transform; carregar o motor de animação apenas onde agrega valor.

## Arquitetura recomendada

**Recomendação para o escopo atual: Astro + TypeScript, com React em ilhas interativas quando necessário.** Astro gera a maior parte da página em HTML; a integração React permite hidratar apenas interações como filtros e galeria. A qualidade das animações não exige que a página toda seja uma aplicação React.

| Opção | Adequação | Decisão proposta |
| --- | --- | --- |
| Astro + React pontual | Conteúdo, fotos, SEO e contato; interação localizada | Preferida para esta landing page |
| Next.js + React | Base inteiramente React, múltiplas rotas e possível evolução para funções de aplicação | Alternativa sólida se houver exigência de React em toda a base ou evolução concreta |
| React + Vite como SPA padrão | Flexível para aplicações, mas exige decisão adicional de pré-renderização para entregar conteúdo inicial em HTML | Não é minha primeira opção aqui; Vite também suporta SSR, mas isso precisa ser configurado |

Usar CSS com variáveis da marca e estilos de componentes; Tailwind é opcional se facilitar manutenção da equipe, sem determinar aparência. CSS e IntersectionObserver podem resolver a maioria das entradas; Motion for React fica restrito às ilhas React que precisem de transições. Não instalar simultaneamente Motion, GSAP e uma biblioteca de smooth scroll sem requisito demonstrado.

Não precisamos de banco, login ou API própria para uma vitrine que encaminha pedidos ao WhatsApp. Caso pagamento no site seja escolhido, reavaliar catálogo, variantes, disponibilidade, frete e checkout antes de fechar a arquitetura; Next.js, por si só, não resolve a operação de e-commerce.

Conteúdo inicial estruturado separadamente do layout: peças com identificador, título, técnica, descrição, imagens/alt, estado comercial e personalizações permitidas; textos traduzíveis em arquivos próprios. Preços opcionais somente com fonte real. Nunca usar preço zero como substituto de “sob consulta”.

Se a Lorrayne precisar editar o site sozinha com frequência, especificar um CMS e sua experiência de atualização antes da implementação. Para atualizações ocasionais feitas pela equipe técnica, arquivos de conteúdo evitam mais uma conta e serviço. Não presumir que um site com conteúdo em código atende a uma usuária não técnica.

Hospedagem: build estático distribuído por CDN, com domínio próprio e prévias de revisão. Escolher provedor conforme domínio, conta, manutenção e eventual formulário; comparar condições comerciais quando a hospedagem entrar no escopo. Nenhum plano pago ou publicação foi contratado nesta etapa.

## Desempenho, descoberta e manutenção

Imagens responsivas com dimensões declaradas e formatos adequados; hero prioritário e sem lazy loading; imagens inferiores sob demanda. Fontes WOFF2 hospedadas com a aplicação, apenas pesos necessários, com fallback. Não incorporar feed automático do Instagram no caminho principal: usar galeria própria e link para o perfil.

Metas propostas: LCP até 2,5 s, INP até 200 ms e CLS até 0,1 no percentil 75 quando houver dados reais. Antes do lançamento, medir carregamento e estabilidade em laboratório, interações no navegador e em telefone real; Lighthouse não comprova sozinho o desempenho real nem a conformidade de acessibilidade. Orçamento inicial sugerido: até 1 MB transferido para a primeira tela, hero móvel preferencialmente até 250 KB, JS inicial comprimido preferencialmente até 100 KB. Ajustar a seleção de ativos para alcançar as metas.

SEO: HTML significativo, idioma correto, título/descrição, um H1 claro, hierarquia, canonical, sitemap, robots e imagem de compartilhamento. Conteúdo local sobre Málaga apenas se confirmado. Se houver idiomas adicionais, rotas próprias e hreflang, sem misturar versões na mesma página. Dados estruturados somente com informações verdadeiras; não publicar avaliação agregada ou preço fictício.

Mensuração proposta, caso seja configurada: origem da visita, categoria explorada e clique de contato por posição/peça. Não registrar texto de encomenda ou mensagens pessoais em analytics. A seleção da ferramenta e configuração de privacidade fazem parte da implementação futura. Encomendas concluídas devem ser avaliadas com dados reais do atendimento.

## Plano de execução futuro

As tarefas verificáveis estão em [todo.md](todo.md). Ordem: fechar conteúdo e operação → desenhar mobile e desktop → implementar abertura e contato → galeria → história/processo/FAQ → movimento → verificar e preparar entrega. Antes de começar a aplicação, o usuário deve revisar esta proposta, conforme seu pedido de planejar primeiro.

Critérios gerais de aceite: identidade fiel; oferta compreensível na abertura; contato contextual funcionando; conteúdo comercial validado; navegação por toque/teclado; ausência de overflow; imagens legíveis; reduced motion funcional; build verificado; nenhuma promessa comercial ou prova social inventada.

## Pendências que alteram o projeto

1. Canal principal: WhatsApp, Instagram ou checkout. Há uma pergunta enviada ao usuário; a análise adota WhatsApp como hipótese baseada no link público.
2. Idioma e mercado: espanhol principal parece coerente com o perfil; confirmar necessidade de português/inglês.
3. Catálogo prioritário, disponibilidade, preço ou orçamento, capacidade e prazo de produção.
4. Entregas: Málaga, Espanha, outros países, retirada e respectivos prazos/custos.
5. Originais das fotografias, vetores e autorização dos depoimentos.
6. Nome público da criadora, redação de sua história e frequência/responsável pelas atualizações.
7. Domínio e hospedagem; requisitos de pagamento se o escopo mudar.

## Fontes

- [DNA Qalbi.pdf](/Users/mag/Downloads/DNA%20Qalbi.pdf), especialmente páginas 5–6, 11–22, 24–39 e 42–46.
- [Prancha de identidade](/Users/mag/Downloads/DOC-20250712-WA0022..pdf).
- [Perfil público](https://www.instagram.com/qalbiatelier/).
- [Exemplos de encomendas](https://www.instagram.com/qalbiatelier/p/DcO0ciLDAYV/).
- [Lenço bordado para casamento](https://www.instagram.com/qalbiatelier/reel/DdB9Z-ds9lS/).
- [Escolha de presentes](https://www.instagram.com/qalbiatelier/p/Db6DMrEjD4y/).
- [Link da bio examinado](https://bit.ly/4hKYqk9).
- [Pépite](https://www.pepiteboisson.ch/).
- [Le Juste Milieu](https://www.le-juste-milieu.ch/).
- [Astro: ilhas](https://docs.astro.build/en/concepts/islands/), [React](https://docs.astro.build/en/guides/integrations-guide/react/) e [imagens](https://docs.astro.build/en/guides/images/).
- [Next.js: componentes de servidor e cliente](https://nextjs.org/docs/app/getting-started/server-and-client-components).
- [Vite: SSR](https://vite.dev/guide/ssr.html).
- [Motion for React](https://motion.dev/docs/react) e [acessibilidade](https://motion.dev/docs/react-accessibility).
- [Web Vitals](https://web.dev/articles/vitals).
