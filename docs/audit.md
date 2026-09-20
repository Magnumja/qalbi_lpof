> Registro histórico da auditoria da landing page. A arquitetura comercial posterior está em [architecture.md](architecture.md) e [commerce.md](commerce.md).

# Auditoria de código, arquitetura e infraestrutura

Data: 9 de setembro de 2026. Escopo: código e configuração deste repositório, dependências instaladas, compilação e inspeção local da galeria. O ambiente de produção não está configurado neste projeto e não foi auditado remotamente.

## Conclusão

A arquitetura existente é apropriada para o produto: uma página estática Astro, com React somente na galeria, imagens otimizadas e fontes locais. As melhorias necessárias eram estabelecer contratos do conteúdo, reduzir repetição dos efeitos e tornar as verificações reproduzíveis. Essas correções foram aplicadas sem adicionar dependências de execução.

Não identifiquei falha crítica nos arquivos revisados. Isso não equivale a certificação de segurança ou acessibilidade. Ainda há trabalho de operação antes de publicar.

## Achados e tratamento

| Prioridade | Achado | Tratamento |
| --- | --- | --- |
| Média | Não havia CI nem um comando que reunisse as verificações; regressões dependiam de checagem manual | Criados `npm run validate` e workflow Quality para push e PR, incluindo auditoria de dependências |
| Média | Catálogo aceitava IDs duplicados, campos vazios e categoria Todas; isso poderia quebrar identidade dos cards e filtros | Tipagem explícita com `satisfies` e validação executada ao importar o catálogo no build; testes de casos inválidos |
| Média | Três implementações de observação de animações; o layout cancelava todas as animações do documento | Um helper compartilha o ciclo de vida e cancela apenas os efeitos que criou; referências são liberadas após término ou cancelamento |
| Baixa | Contrato da galeria ficava no arquivo que também importa todas as fotos | Tipos separados em `src/content/types.ts`; React recebe somente dados serializáveis |
| Baixa | Preparação das fotos enviava uma propriedade `image: undefined` como resíduo do cadastro | Desestruturação separa a imagem dos campos enviados; saída declarada como `GalleryPiece[]` |
| Média | Versão de Node não era reproduzida pela infraestrutura | `.nvmrc` fixa 22.23.2, CI usa esse arquivo e o requisito mínimo foi alinhado aos testes nativos |
| Baixa | Não havia padrão de editor nem detecção de variáveis/parâmetros sem uso | `.editorconfig`, comando de formatação e opções adicionais do TypeScript |
| Média, pendente antes de publicar | Sem domínio, hospedagem, headers ou rollback definidos no repositório | Procedimento e responsabilidades documentados em `architecture.md`; depende da escolha do provedor |

## Verificações realizadas

- `npm ci`: reinstalação a partir do lockfile concluída.
- `npm run validate`: formatação, Astro/TypeScript, seis testes e build concluídos.
- TypeScript: zero erros, avisos ou hints nos 20 arquivos analisados.
- Testes: catálogo vazio/válido, técnica nova, IDs duplicados/inválidos, campos vazios, categoria reservada/espaços, telefone de contato e preservação de acentos/caracteres especiais na mensagem.
- Navegador após a refatoração: filtro Ganchillo, detalhes do panda, link contextual de WhatsApp, Escape e retorno a Todas conferidos.
- `npm audit`: zero vulnerabilidades conhecidas reportadas nesta execução. O resultado é temporal e limitado à base de avisos consultada.
- Dependências de aplicação: nenhuma adicionada ou atualizada nesta auditoria. Lockfile mudou somente o requisito de Node do projeto.
- Workflow usa actions fixadas por SHA, checkout sem credenciais persistidas, permissões de leitura e timeout. Não há etapa de deploy ou segredo solicitado.

## Desempenho e simplicidade

O build continua estático. O catálogo e o processamento das imagens ficam no build; não há chamadas a banco de dados ou API própria. Os arquivos JavaScript gerados somam aproximadamente 197 KB sem compressão, incluindo o runtime React (aproximadamente 184 KB). Isso é tamanho em disco, não medição de transferência, LCP ou desempenho em telefone.

Manter React é uma decisão de manutenção: filtro, seleção e diálogo já usam esse modelo. Reescrever a galeria inteira para reduzir runtime não foi necessário para a organização solicitada. Se métricas reais indicarem custo relevante, avaliar essa troca em uma alteração específica, com testes de interação.

CSS local permanece nos componentes Astro. Não foram criadas camadas de serviços, repositórios, estado global ou componentes genéricos sem reutilização. O mapa das responsabilidades está em `architecture.md`.

## Limites e pendências

- O workflow foi criado e seus comandos passaram localmente; ele ainda não foi executado no GitHub nesta tarefa. Não houve push. A proteção de branch precisa ser configurada para exigir o check `quality`.
- A auditoria não inclui servidor, DNS, TLS, headers HTTP, cache CDN ou logs de produção. Não há provedor definido para verificar esses itens.
- Os testes automatizados cobrem regras de conteúdo e links. Não há suíte E2E automatizada, relatório de cobertura ou medição Lighthouse nesta rodada. As verificações de interface no navegador são complementares, não uma certificação WCAG.
- As fotos existentes têm resolução limitada. Obter originais continua sendo a melhoria de qualidade visual mais relevante para exibição ampliada.
- Antes da publicação: confirmar dados comerciais, escolher domínio/provedor, configurar metadados sociais/canonical/sitemap, validar cache e headers com o HTML gerado, testar em telefone físico e documentar uma publicação anterior para rollback.

Referências oficiais usadas para conferir a infraestrutura: [Astro: publicação estática](https://docs.astro.build/en/guides/deploy/), [GitHub setup-node](https://github.com/actions/setup-node), [GitHub checkout](https://github.com/actions/checkout), [Node: execução de TypeScript](https://nodejs.org/api/typescript.html).
