# Auditoria de interação e fluxos E2E

Auditoria local concluída em 20/09/2026, com ressalvas de cobertura abaixo. Combina navegação real, revisão de código e testes automatizados com PostgreSQL. Não equivale à homologação de produção nem a pesquisa de usabilidade com clientes reais.

## Gargalos corrigidos

| Prioridade | Problema observado | Mudança aplicada |
| --- | --- | --- |
| Alta | Atualizar a página apagava a seleção | Carrinho preservado na sessão da aba, com validação de IDs, quantidades e disponibilidade |
| Alta | Campo de quantidade permitia exceder o estoque na interação | Quantidades limitadas pela regra do carrinho; servidor continua validando o estoque na transação |
| Alta | Pagamento indisponível terminava em erro previsível | Aviso antes de criar o pedido e orientação no acompanhamento; botão de pagamento condicionado à configuração |
| Média | Detalhes apareciam abaixo de todo o catálogo | Janela de detalhes com título acessível, foco inicial, fechamento por Escape e retorno ao contexto |
| Média | Falhas de rede ou respostas inesperadas eram pouco compreensíveis | Mensagens em espanhol com orientação para consultar os pedidos antes de repetir uma operação incerta |
| Média | Painel parecia não ter trabalho quando havia pedidos aguardando pagamento | Indicador específico de pedidos pendentes de pagamento |
| Média | Atualizar a conta perdia o pedido aberto | Identificação do pedido preservada na URL |
| Média | Editor de produtos podia perder alterações ao trocar de peça ou seção | Proteção de alterações não salvas e aviso ao sair; teste visual do diálogo permanece inconclusivo |
| Média | Falha ao recarregar a lista após criar produto poderia incentivar novo cadastro | Estado atualizado diretamente pela resposta de salvamento, sem depender de uma segunda consulta |
| Baixa | Seleção vazia tinha atalho sem destino útil | Atalho aparece quando há itens |
| Baixa | Sucesso de troca de senha aparecia como erro | Aviso de sucesso separado, com envio desabilitado enquanto processa |

O checkout também explica suas etapas. O pedido personalizado informa quando é necessário aguardar um orçamento. A conta oferece uma nova tentativa quando o carregamento falha.

## Evidência e cobertura

| Fluxo | Resultado | Método |
| --- | --- | --- |
| Abrir detalhes e fechar por Escape | Aprovado | Navegador local |
| Adicionar peça e atualizar a página | Seleção recuperada | Navegador local |
| Informar 20 unidades com somente 2 disponíveis | Pedido criado com 2 unidades | Navegador + API + PostgreSQL |
| Preencher endereço e criar pedido | Pedido de teste nº 2 persistido | Navegador local |
| Pedido sem Stripe configurado | Orientação visível; pagamento não oferecido | Navegador local |
| Enviar mensagem como cliente | Mensagem visível no pedido e no painel | Navegador local |
| Administrador abrir pedido e responder | Resposta enviada pelo painel | Navegador local |
| Cancelar pedido não pago | HTTP 200; estoque devolvido de 0 para 2 | API local e consulta ao banco; cancelamento pela interface não repetido |
| Trocar seção com produto não salvo | Inconclusivo | Automação travou ao acionar a confirmação; não marcado como aprovado |
| Contagem de pendências, isolamento, estoque, pagamentos simulados | Aprovado | Suíte de integração |
| Carrinho inválido e mensagens de falha | Aprovado | Testes unitários |

Validação completa: **25 testes passaram** (9 na raiz e 16 no servidor), sem erros ou avisos de tipos, formatação aprovada e build concluído. `npm audit --audit-level=high` retornou zero vulnerabilidades conhecidas. Isso não substitui auditoria independente de segurança.

O produto fictício foi despublicado, o pedido de teste foi cancelado e seu estoque restaurado. O histórico de teste foi preservado. Não houve cobrança ou envio de comunicação externa.

## Limites desta rodada

- Checkout hospedado, autenticação de cartão e webhook de uma conta Stripe não foram exercitados contra o provedor. Os testes de pagamento usam simulação da API e assinaturas locais.
- Neon, Render e Vercel não foram homologados em ambiente publicado.
- A retomada da inspeção visual encontrou bloqueio da ferramenta na página de erro de conexão, após os serviços locais terem parado. Os serviços foram reiniciados; as verificações visuais restantes não foram declaradas aprovadas.
- Não houve teste em celular físico, leitor de tela ou medição de desempenho em rede móvel nesta rodada. As verificações responsivas anteriores não substituem essa homologação.
- O fluxo de orçamento e a edição da home contam com testes de integração e verificações de etapas anteriores; não foram repetidos integralmente no navegador nesta rodada.
- A confirmação da resposta administrativa na tela do cliente após o envio também deve ser retomada. A mensagem foi enviada com sucesso no painel, mas essa última leitura não foi reconferida.

## Próximas melhorias de maior impacto

1. **Recuperação de senha por email:** hoje a recuperação depende de intervenção administrativa; isso impede autonomia quando o cliente esquece a senha.
2. **Notificações de orçamento, prazo e novas mensagens:** hoje o cliente precisa voltar ao pedido; o chat atualiza enquanto a página está aberta.
3. **Upload de fotos também nos produtos:** já existe na edição da home, mas o catálogo ainda exige caminho de imagem ou URL. Unificar essa experiência facilita a operação pela proprietária.
4. **Homologação com conteúdo real:** preencher catálogo, frete e prazos reais e observar uma pessoa sem orientação escolhendo uma peça, solicitando personalização e consultando uma resposta. Registrar onde ela hesita antes de acrescentar mais recursos.

## Roteiro simples para repetir

Use banco e contas de teste, sem cartões ou pedidos reais. Na loja, abra os detalhes, adicione uma peça, atualize, ajuste a quantidade e envie o pedido. Em **Mi cuenta**, abra o pedido e envie uma mensagem. No painel, localize esse pedido, responda e confira a resposta novamente como cliente.

Para encomendas, entre em **Encargo**, descreva a peça e envie. No painel, confira os dados e informe orçamento e prazo. Volte à conta do cliente e confirme que o próximo passo está claro. Pagamento deve ser homologado separadamente em modo de teste do Stripe.

Para conteúdo, use **Página inicial**, altere um card de teste, confira a prévia e publique; recarregue a home. Em **Productos**, teste salvar, continuar editando e tentar trocar de seção sem salvar. Confirme que cancelar o descarte mantém o texto digitado.

## Auditoria de telas — proximidade cliente ⇄ atelier (20/09/2026)

Objetivo: em cada tela, a pessoa deve saber **o que fazer a seguir** e **como falar com o outro lado** sem sair procurando. Revisão feita no navegador (Chrome headless, 390 px e 1280 px) e por leitura do código, com dados de teste locais.

| Prioridade | Tela | Gargalo observado | Resolução aplicada |
| --- | --- | --- | --- |
| Alta | Painel · pedido | O atelier via nome do cliente, mas não email nem telefone; para combinar detalhes fora do chat precisava consultar o banco | Bloco **Cliente** com email (mailto) e WhatsApp com mensagem pronta citando o pedido |
| Alta | Conta · lista / Painel · lista | Ninguém sabia que havia mensagem nova sem abrir cada pedido | Contador de mensagens novas por pessoa (`order_reads`), selo por pedido, resumo no topo da conta e indicador "Conversaciones con mensajes nuevos" no painel |
| Alta | Login · cliente | Esqueceu a senha → dependia de intervenção técnica | Atelier gera **link de acesso** único (24 h) a partir do pedido, com copiar e enviar por WhatsApp; `/cuenta?acceso=…` pede nova senha e entra, revogando sessões antigas |
| Média | Conta · pedido | Chat era o único canal; sem alternativa quando o cliente prefere WhatsApp | Link "Escribe al atelier" com o número do pedido na mensagem |
| Média | Painel · produtos | Foto exigia URL ou arquivo em `public/shop/`; fluxo diferente do editor da home | Mesmo `PhotoField` da home: upload otimizado, prévia, placeholder quando vazio |
| Baixa | Conta · link expirado | Texto mandava "pedir na conversa", mas quem perdeu a senha não acessa a conversa | Link direto de WhatsApp para pedir outro |

Comportamento a conhecer: conversas antigas contam como "novas" até serem abertas uma vez após esta atualização, porque não havia registro de leitura antes. Abrir o pedido ou enviar mensagem marca a leitura.

### Evidência desta rodada

- `npm run validate`: formatação, 65 arquivos sem erros de tipos, 9 testes de conteúdo/proxy, **19 testes de API** (3 novos: contagem de mensagens por pessoa; link de acesso único/expirado/revogação de sessões; produto com foto subida) e build de 6 páginas.
- Fluxo real via proxy do preview: cadastro com telefone → encomenda → mensagem do cliente → painel mostra 1 nova → abrir zera → resposta do atelier → conta mostra 1 nova → link de acesso gerado → nova senha → sessão antiga expirada, nova sessão válida.
- Capturas em 390 px: conta (lista com selo), painel (5 indicadores, lista com selos), pedido no painel (bloco Cliente e "El cliente no puede entrar"), tela de nova senha, editor de produtos com upload. Sem rolagem horizontal em nenhuma.
- Ambiente: o `server/.env` local apontava para um PostgreSQL em porta antiga; os testes rodaram com `TEST_DATABASE_URL` no PostgreSQL temporário atual (`qalbi_test`). Ajuste o `.env` local se for repetir.

### Observações não resolvidas (próximas)

1. **Teste em telefone físico e leitor de tela** seguem pendentes; as capturas são de navegador headless.
2. **Avisos por email** estão implementados mas dependem de `RESEND_API_KEY`/`NOTIFY_FROM` e de domínio com SPF/DKIM; sem isso o contador na conta é o único aviso.

Também na mesma data (Fases 1, 3, 4 e 5 do plano): avisos por email com fila, agrupamento e opt-out; link compartilhável e botão "Compartir" nas peças; foto na conversa com acesso restrito aos participantes; reembolso/disputa refletidos do Stripe; log JSON por requisição; `npm run db:test`; suíte Playwright com 5 jornadas em 390 px (`npm run test:e2e`). Total: 9 testes de conteúdo/proxy, 23 de API, 5 no navegador.

Resolvidas na mesma data (Fase 2 do plano): indicadores do painel viram filtros (`?filter=`), lista ordenada por "precisa do atelier" e formulários de orçamento/avanço movidos para logo após "Tu idea" (captura em 390 px: ação visível na segunda tela em vez da quarta). Teste de API cobre filtro, ordenação e filtro inválido; 20 testes de API no total.
