# Operação da loja

## Fluxos

**Peça do catálogo:** cliente cria conta, escolhe peças e endereço, confirma pedido, paga pelo Checkout Stripe e acompanha a preparação. O servidor recalcula o total. Peças prontas reservam estoque na criação do pedido. Peças sob encomenda usam prazo cadastrado e não descontam estoque físico.

**Peça personalizada:** cliente descreve a ideia e endereço, administrador conversa pelo pedido e envia orçamento com valor final (incluindo frete) e data. Só então o cliente pode pagar. O prazo do orçamento é uma data definida pelo atelier; confirme se continua adequado antes de receber um pagamento tardio.

**Produção:** depois da confirmação de pagamento, o admin avança uma etapa por vez: confirmado → em preparação → pronto → enviado → concluído. Pode ajustar prazo e referência de envio. Todas as mudanças relevantes ficam no histórico. Os indicadores mostram pedidos para orçar, em preparação e com prazo vencido.

**Conversa:** somente dono do pedido e administradores podem ler/enviar mensagens. Últimas 200 mensagens são exibidas, com atualização a cada 10 segundos em aba visível. O banco mantém as anteriores. Abrir o pedido ou enviar mensagem registra a leitura por pessoa (`order_reads`); as listas mostram quantas mensagens do outro lado chegaram desde então e o painel conta as conversas com novidades. Não há anexos, aviso por email ou notificações push. O painel mostra email e telefone do cliente com atalho de WhatsApp; o cliente tem atalho equivalente para o atelier.

## Estoque e pagamentos

- Estoque representa unidades **disponíveis**, excluindo reservas. Ao editar, considere reservas existentes; não substitua pelo total físico incluindo pedidos já reservados.
- Reserva de catálogo sem tentativa de pagamento vence em 60 minutos e é liberada pela manutenção da API. Sessões Checkout duram 60 minutos desde a primeira tentativa; eventos de expiração liberam estoque.
- Preço e título são copiados ao pedido. Alterar produto não altera pedidos anteriores.
- Criação de pedido usa uma chave idempotente por tentativa. Chamadas repetidas não criam reservas duplicadas. O Checkout também possui chave estável por pedido.
- Pagamento só é confirmado após consultar dados autenticados do Stripe: assinatura do webhook ou reconciliação administrativa com a API do provedor. Valor, moeda e pedido devem coincidir.
- Falha de rede pode deixar pagamento `pending` sem ID local. Não liberamos estoque nesse caso, porque uma sessão pode existir no Stripe. Repita o botão de pagamento para recuperar pela chave idempotente dentro da janela permitida. Se necessário, copie a sessão `cs_...` do Stripe e reconcilie no painel.
- Se não existir sessão no Stripe e a janela de recuperação já terminou, é necessária intervenção técnica: primeiro confirmar ausência de sessão/cobrança no provedor, depois liberar a reserva em transação. Não há liberação automática de um pagamento incerto.
- Cancelar pedido não pago encerra a sessão no Stripe antes de liberar estoque. Pedido pago não pode ser cancelado por esse atalho.
- Reembolsos e disputas são tratados no Stripe nesta versão. Eles **não sincronizam automaticamente** para o painel; registre atendimento e ajuste operacional com suporte técnico. Não lançar vendas que dependam de um processo de reembolso automático sem implementar essa integração.

## Dados e acesso

PostgreSQL contém usuários, hashes de senha, sessões, produtos, pedidos, itens, mensagens, histórico, eventos Stripe e limites de requisição. Endereço e email são dados pessoais; limitar acesso ao banco, manter backup e definir retenção faz parte da operação do atelier.

Senhas usam scrypt com salt. Cookies de sessão são HttpOnly, SameSite=Lax e Secure em produção; o banco guarda apenas hash do token. Validade: sete dias. Logout revoga a sessão atual; troca de senha revoga todas. Alterações exigem origem exata e um header da aplicação. Queries são parametrizadas; campos são validados com Zod; mensagens são renderizadas como texto pelo React.

Cadastro público só cria cliente. Pedidos de outra pessoa retornam 404; rotas administrativas retornam 403 para clientes. O admin é criado por comando de operador. Nenhuma chave Stripe ou credencial Neon é enviada ao navegador.

Há limites persistidos para cadastro, login, pedidos e mensagens. Atrás do proxy Vercel, limites por IP podem agrupar visitantes; para maior volume, adicionar identificação de cliente autenticada entre os proxies ou rate limiting na borda. Não confiar em headers arbitrários enviados pelo navegador.

## Limites explícitos desta versão

- EUR e frete fixo por pedido, países permitidos configuráveis; sem cotação por código postal, imposto automático, cupons ou múltiplas moedas.
- Carrinho mantido na sessão da aba: atualizar ou navegar no site preserva IDs e quantidades. Fechar a aba encerra essa sessão. Ao carregar o catálogo, produtos indisponíveis são removidos e quantidades respeitam o estoque atual. Após criar o pedido, a seleção é limpa; o pedido permanece no banco. Dados pessoais e preços não são gravados nesse armazenamento.
- Sem recuperação automática de senha ou verificação de email. Cliente autenticado pode trocar senha. Para recuperação, o atelier confirma a identidade pelo canal habitual e gera no pedido um **link de acesso** único (24 h, invalida o anterior); ao usá-lo o cliente define nova senha e todas as sessões antigas caem. Só funciona para contas de cliente. Não há ferramenta pública para assumir conta.
- Fotos de produtos e da home usam o mesmo upload (reencodado em WebP, guardado no banco), ou URL HTTPS / arquivo em `public/shop/`. Veja `comoadicionarfotos.md`.
- Catálogo público até 200 produtos, painel de produtos até 500, conta mostra 100 pedidos recentes e admin pagina de 50 em 50. Histórico mostra 100 eventos recentes.
- Não inclui reembolso no painel, sincronização de disputas, emails transacionais, anexos ou relatórios fiscais.
- Não houve homologação em conta Stripe, Neon, Render ou Vercel. Testes locais usam PostgreSQL real e provedor de pagamento simulado.

## Verificações feitas

A suíte cobre hashes de senha, sessão obrigatória, CSRF, papel administrativo, isolamento de pedidos e mensagens, preço no servidor, idempotência, disputa pela última unidade, orçamento, assinatura Stripe, valor divergente, eventos duplicados, transições de produção, liberação única de estoque, reservas vencidas e reconciliação com sessão divergente. Verificações de tipos e build complementam os testes. A inspeção no navegador verifica os fluxos da interface; não é auditoria externa de segurança.

### Revisão local em 19/09/2026

- `npm run validate`: 6 testes de conteúdo e 11 testes de API aprovados, 47 arquivos verificados sem erros de tipos, cinco páginas compiladas.
- `npm audit --audit-level=high`: nenhuma vulnerabilidade conhecida reportada.
- Navegador: cadastro/login, encomenda persistida, envio e leitura de mensagens, login administrativo, orçamento com prazo e cadastro de produto em rascunho.
- Inspeção visual do pedido no desktop e da central em iframe com largura de 390 px. Não equivale a teste em aparelho físico.
- Dados de QA são somente locais e identificados como teste. Nenhum produto real teve preço atribuído e nenhuma cobrança foi feita.

### Editor da home — 19/09/2026

A revisão posterior acrescentou edição dos destaques, upload otimizado, fotos principais e publicação com controle de versão. A suíte passou com **20 testes** (7 de conteúdo/proxy e 13 de API). No navegador, alteração de título/foto, prévia e publicação foram conferidas na home sem rebuild; o conteúdo de teste foi restaurado. A reencodificação do upload e a preservação dos bytes pelo proxy foram verificadas automaticamente.


## Acessos de clientes e administrador

Clientes entram por email **ou** telefone com a mesma senha. O cadastro exige nome, email e senha; telefone é opcional e inclui o código internacional (+34, +55 etc.). Espaços, parênteses e hífens são normalizados e cada telefone só pertence a uma conta. Contas anteriores continuam usando email e podem adicionar/remover telefone em **Mi teléfono de acceso**, confirmando a senha.

Este acesso não envia códigos por SMS/WhatsApp: o telefone funciona como identificador acompanhado de senha. Não há verificação de posse do telefone ou email nesta versão. O email segue necessário para contato e Checkout. A operação deve tratar mudança de titularidade/recuperação por atendimento; não usar telefone não verificado como prova de identidade.

O administrador entra em `/admin/login`, num layout separado. Seu login não possui cadastro público e só aceita conta administrativa. A conta inicial é criada por `ADMIN_EMAIL`, `ADMIN_PASSWORD` e `ADMIN_NAME` no backend, uma única vez. Reinicializações não resetam senhas nem promovem clientes existentes. Veja o guia de publicação para recuperação explícita.

Uma sessão por navegador seleciona a conta em uso; entrar com outra conta revoga a sessão anterior desse navegador. A separação das telas não substitui permissões: as rotas administrativas continuam restritas no servidor.

### Separação de acessos — 20/09/2026

Validação concluída com 22 testes (7 de conteúdo/proxy e 15 de API), build de seis páginas e tipos sem erros. Testes adicionais cobrem entrada por email/telefone normalizado, telefone duplicado, alteração protegida por senha, recusa de cliente no login administrativo e seed idempotente que não promove cliente nem redefine senhas no startup. A tela administrativa foi inspecionada no navegador em desktop e 390 px, incluindo login e logout.
A entrada do cliente por telefone também foi exercitada no navegador com conta local de QA. Ao tentar abrir `/admin`, esse cliente foi encaminhado a `/admin/login`, sem acesso aos pedidos administrativos.
