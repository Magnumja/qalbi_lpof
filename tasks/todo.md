# Qalbi — tarefas futuras de implementação

Status: primeira versão implementada para revisão em 9 de setembro de 2026, após o usuário autorizar o início. Stack: Astro + TypeScript + React pontual. Ver docs/qa.md para evidências e limites dos testes.

## Entrega desta etapa

- [x] Identidade original, fotos reais e abertura com contato direto.
- [x] Seis criações, filtros, detalhes ampliados e mensagem contextual por peça.
- [x] História, apresentação da criadora, processo, dúvidas e convite final.
- [x] Layouts móveis e desktop, movimento discreto e preferência de movimento reduzido implementada.
- [x] Verificação de tipos, build, navegação e larguras de 320 a 1440 px.
- [x] Instruções de edição e origem dos ativos documentadas.
- [ ] Revisão final da redação pessoal e operação comercial pela responsável.
- [ ] Originais de fotos em maior resolução, domínio, metadados de publicação e validação em telefone físico.

O detalhamento original abaixo permanece como roteiro; marcações pendentes incluem validações humanas e trabalho de publicação que não integram a entrega local.

## 1. Fechar o conteúdo comercial e os ativos

Confirmar como o visitante encomenda, o idioma, as peças prioritárias e as informações operacionais.

Aceite:
- [ ] Canal, idioma, contato, área atendida e regras de encomenda confirmados.
- [ ] 6–9 peças selecionadas, com descrição e situação comercial verdadeiras.
- [ ] Fotos originais e ativos de marca disponíveis ou lacunas identificadas.

Verificação: revisão factual com a responsável e confronto com a fonte de cada informação. Dependências: nenhuma. Arquivos prováveis: tasks/plan.md, docs/content.md, docs/assets.md. Escopo: médio.

## 2. Aprovar a direção visual em mobile e desktop

Definir composição de hero, galeria, processo e contato usando conteúdo real.

Aceite:
- [ ] Composições em 390 e 1440 px com hierarquia coerente e produto visível cedo.
- [ ] Paleta, fontes, fotografia e três comportamentos de movimento demonstráveis.
- [ ] Revisão do usuário registrada antes da implementação da aplicação.

Verificação: revisão visual, leitura em tamanho real e contraste. Dependências: 1. Arquivos prováveis: docs/design.md e pranchas de direção visual. Escopo: médio.

## Checkpoint de pré-produção

- [ ] Operação e aparência estão concretas o suficiente para implementação.
- [ ] Decisão de framework registrada; dependências desnecessárias excluídas.

## 3. Implementar abertura e caminho direto de contato

Criar a menor página navegável com identidade, oferta, foto e ação principal. Se houver scaffold, fazê-lo como etapa mecânica separada da composição do hero.

Aceite:
- [x] Conteúdo inicial em HTML, fontes e foto responsiva.
- [ ] CTA encaminha ao destino confirmado com texto correto e editável.
- [ ] Menu e layout funcionam por toque e teclado em celular e desktop.

Verificação: build de produção, navegação no navegador e inspeção da URL do CTA sem enviar mensagem. Dependências: 2. Arquivos de interface prováveis: src/layouts/Base.astro, src/pages/index.astro, src/components/Hero.astro, src/styles/tokens.css. Escopo: médio, além do scaffold.

## 4. Implementar galeria e interesse por peça

Apresentar as três técnicas e os trabalhos selecionados; adicionar React apenas se filtro/galeria justificar.

Aceite:
- [ ] Cada peça tem foto, técnica, texto e situação comercial inequívoca.
- [x] Ação contextual identifica a peça e preserva o contato direto.
- [ ] Filtro ou ampliação, se usados, funcionam por teclado e toque.

Verificação: categorias, URLs por peça, carregamento de imagens e retorno de foco ao fechar a ampliação. Dependências: 3. Arquivos prováveis: src/content/pieces.*, src/components/Creations.astro, src/components/CreationGallery.tsx, src/lib/contact.ts. Escopo: médio.

## Checkpoint comercial

- [ ] É possível entender a oferta, encontrar um exemplo e iniciar contato.
- [ ] Build funciona e nenhum produto anterior parece disponível sem confirmação.

## 5. Implementar processo, autoria e dúvidas

Adicionar as informações necessárias para o visitante confiar e saber como encomendar.

Aceite:
- [ ] História e processo refletem conteúdo confirmado.
- [ ] FAQ responde dúvidas operacionais sem dados fictícios.
- [x] Prova social só aparece se houver conteúdo real autorizado.

Verificação: revisão editorial e factual, teclado no FAQ e leitura em celular. Dependências: 3 e conteúdo da tarefa 1. Arquivos prováveis: src/components/Process.astro, src/components/About.astro, src/components/FAQ.astro, src/components/Footer.astro, src/content/site.*. Escopo: médio.

## 6. Aplicar movimento e refinamento responsivo

Dar à página os gestos de marca aprovados, mantendo conteúdo acessível e rolagem confortável.

Aceite:
- [ ] Animações correspondem à direção aprovada e não atrasam a ação principal.
- [ ] Reduced motion mostra todos os conteúdos sem transformações desnecessárias.
- [ ] CTA inferior respeita conteúdo, teclado e safe area.

Verificação: navegação completa em telefone real, preferência de movimento reduzido e JavaScript desativado para conteúdo essencial. Dependências: 4 e 5. Arquivos prováveis: src/styles/motion.css, src/scripts/reveal.ts, src/components/StickyContact.astro e até dois componentes ajustados. Escopo: médio.

## 7. Preparar descoberta, compartilhamento e mensuração

Concluir metadados, imagem social e eventos mínimos de intenção, se a mensuração for escolhida.

Aceite:
- [ ] Título, descrição, idioma, canonical, sitemap e imagem social corretos.
- [ ] Dados estruturados usam somente informações confirmadas.
- [ ] Eventos distinguem cliques de contato de vendas e não capturam mensagens pessoais.

Verificação: inspeção do HTML de produção, compartilhamento de teste e eventos apenas em ambiente de teste. Dependências: 4 e 5. Arquivos prováveis: src/layouts/Base.astro, astro.config.*, src/lib/analytics.ts e public/og.*. Escopo: médio.

## 8. Verificar entrega e preparar hospedagem

Registrar as evidências finais e preparar uma versão revisável antes de publicação.

Aceite:
- [x] Larguras 320, 360, 390, 430, 768, 1024 e 1440 px sem overflow ou conteúdo encoberto.
- [ ] Build de produção aprovado; fluxo central, acessibilidade e desempenho inspecionados.
- [ ] Domínio, hospedagem, manutenção e lacunas restantes registrados.

Verificação: browser em Safari/Chrome conforme disponibilidade, telefone real, auditoria de carregamento e estabilidade; testes automatizados focados apenas nas interações que justificarem cobertura. Registrar comandos e resultados efetivamente executados. Dependências: 6 e 7. Arquivos prováveis: docs/qa.md, docs/maintenance.md e configuração de hospedagem, quando escolhida. Escopo: médio.

## Checkpoint de entrega

- [ ] Conteúdo e contato revisados pela responsável.
- [ ] Versão concreta disponível para revisão.
- [ ] Publicação só quando entrar no escopo autorizado; nenhuma publicação faz parte desta etapa de análise.
