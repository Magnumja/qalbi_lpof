# Verificação da primeira versão

Data: 9 de setembro de 2026. Branch: `codex/qalbi-landing`.

## Verificações executadas

- `npm run format:check`: aprovado.
- `npm run check`: 15 arquivos, zero erros, avisos e sugestões.
- `npm run build`: HTML estático e imagens WebP gerados com sucesso.
- Auditoria do npm durante atualização do lockfile: zero vulnerabilidades reportadas naquele momento.
- Verificação do HTML produzido: um H1; nenhuma imagem sem atributo alt; nenhum destino de âncora interno faltando; todos os ativos locais de imagem, script e stylesheet referenciados encontrados em dist.
- O arquivo temporário da revisão responsiva foi removido e não está no build final.
- Inspeção do console no navegador: nenhum erro ou aviso observado na página funcional.

## Navegação e interação

- Links da abertura e menu levam às seções correspondentes.
- Galeria: Bordado mostra duas peças; Ganchillo mostra três; todas as seis criações estão no HTML inicial.
- Abrir detalhes mostra descrição, imagem e CTA contextual.
- Escape fecha o diálogo e devolve o foco ao botão que o abriu.
- URLs de WhatsApp incluem o número público e o nome da peça codificado na mensagem. Nenhuma mensagem foi enviada durante os testes.
- Menu móvel abre por Enter e fecha ao escolher uma seção. Escape também está implementado para fechamento.
- FAQ de preço abre por teclado e apresenta a resposta sem preço fictício.
- Contato móvel: confirmado oculto na abertura, visível após sair do CTA inicial e oculto na seção final.
- O observador de interseção sozinho não atualizou o contato móvel em um trajeto de teste. Foi adicionado um listener passivo de rolagem limitado por requestAnimationFrame, e o trajeto foi refeito com sucesso.

## Responsividade e inspeção visual

Larguras verificadas no navegador por iframe local com largura controlada:

| Largura | Largura total do documento | Rolagem horizontal |
| ------- | -------------------------- | ------------------ |
| 320 px  | 320 px                     | Não                |
| 360 px  | 360 px                     | Não                |
| 390 px  | 390 px                     | Não                |
| 430 px  | 430 px                     | Não                |
| 768 px  | 768 px                     | Não                |
| 1024 px | 1024 px                    | Não                |
| 1440 px | 1440 px                    | Não                |

A menor largura foi novamente inspecionada depois do aumento de textos móveis. Revisão visual por capturas: abertura, galeria, diálogo, apresentação da criadora e processo. A instrumentação de clique dentro do iframe não foi confiável; os controles móveis foram exercitados por teclado. Não houve teste em telefone físico ou em uma matriz completa de navegadores.

## Desempenho e acessibilidade: evidência e limites

Os três arquivos JavaScript externos do build somam aproximadamente 61 KiB com gzip local, majoritariamente React. A galeria carrega por `client:visible`; o restante usa scripts pequenos e HTML estático. A imagem principal WebP ficou em aproximadamente 27 KiB. Isso não é uma medição de LCP, INP, CLS ou velocidade real de conexão.

Fontes são locais; imagens inferiores usam lazy loading; hero tem prioridade de carregamento; dimensões são declaradas; conteúdo e links comerciais essenciais estão presentes no HTML gerado. As regras de movimento reduzido e o cancelamento de animações foram revisados no código. Não foi simulada a preferência de movimento reduzido do sistema, nem executado axe, Lighthouse ou leitor de tela nesta etapa. Não se declara conformidade integral WCAG ou metas de Web Vitals atingidas.

## Ocorrências do ambiente

Ao retomar, o servidor de desenvolvimento respondeu 500 após reinícios de configuração. O diagnóstico apontou a resolução de rota do servidor do Astro; a verificação de tipos estava limpa. Reiniciar o processo restaurou a resposta 200. A entrega usa também o servidor de prévia do build em http://127.0.0.1:4322, independente do estado de recarregamento do desenvolvimento.

## Pendências antes de publicar

1. Responsável revisar a redação em primeira pessoa, nomes editoriais e número de contato.
2. Obter fotografias originais em maior resolução, especialmente o hero.
3. Confirmar operação de entrega, prazos e preços caso sejam exibidos no futuro.
4. Definir domínio e completar canonical, sitemap, imagem social e informações legais da operação.
5. Validar a página em um telefone real e realizar medições de desempenho na hospedagem escolhida.

## Ajuste da galeria — 9 de setembro de 2026

- Todos os cards usam proporção 1:1 e canto superior direito de 30%, independentemente do filtro.
- Conferência no navegador: seis recortes de aproximadamente 365 × 365 px em três colunas no desktop; seis recortes de aproximadamente 168 × 168 px em duas colunas no iframe de 390 px. Nenhum transbordamento horizontal nesse iframe.
- Filtro Ganchillo mostrou três peças. Detalhes do panda abriram por teclado, o link continha o título correto e Escape fechou a janela. Retorno ao filtro Todas conferido.
- Entrada por IntersectionObserver e Web Animations API com cancelamento ao trocar o filtro ou ativar movimento reduzido; zoom e setas com alternativa CSS sem movimento. Preferência de movimento reduzido revisada no código, sem teste de configuração do sistema nesta rodada.
- `npm run check`, `npm run build` e `npm run format:check` passaram. Página temporária de revisão removida da compilação.
- Guia de cadastro em `comoadicionarfotos.md`, com categorias e botões gerados a partir do conteúdo.
