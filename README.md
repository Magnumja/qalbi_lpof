# Qalbi Atelier

Site institucional e loja em espanhol: catálogo, carrinho, pedidos, encomendas sob orçamento, pagamento por cartão via Stripe e central administrativa com prazos e conversa por pedido.

**Infraestrutura:** frontend Astro + React na Vercel, API Node/Express no Render e PostgreSQL no Neon. A galeria editorial continua independente do catálogo comercial. Não há preços ou estoque reais inventados.

## Rodar localmente

Use Node **22.23.2** (`nvm use`) e PostgreSQL. Na raiz:

```sh
npm ci
cp server/.env.example server/.env
```

Preencha `DATABASE_URL` em `server/.env` com seu banco local e mantenha `FRONTEND_URL=http://127.0.0.1:4321`. Depois:

```sh
npm run db:migrate
npm run server:dev
```

Em outro terminal, na raiz:

```sh
npm run dev
```

Abra http://127.0.0.1:4321. O Astro encaminha `/api` à API local na porta 4000. Para usar a prévia em 4322, altere também `FRONTEND_URL` e reinicie a API. Login e formulários exigem a mesma origem exata, incluindo a porta. PostgreSQL guarda os pedidos; não são dados simulados no navegador.

Sem as duas chaves Stripe, é possível cadastrar produtos, pedir orçamento e conversar; o pagamento fica indisponível. Não informe chaves no código nem em mensagens de chat.

## Acessos

| Caminho | Função |
| --- | --- |
| `/` | Apresentação e galeria do atelier |
| `/tienda` | Produtos, seleção e criação do pedido |
| `/encargo` | Solicitar uma peça personalizada |
| `/cuenta` | Acesso por email ou telefone + senha, pedidos e mensagens |
| `/admin/login` | Login exclusivo do administrador |
| `/admin` | Produtos, orçamentos, produção, atendimento e edição da home |

Para criar o administrador automaticamente, configure `ADMIN_EMAIL`, `ADMIN_PASSWORD` e opcionalmente `ADMIN_NAME` no backend. Os detalhes e o comando de recuperação estão no [guia de publicação](docs/deployment.md). Cadastrar uma conta pela página sempre cria um cliente, nunca um administrador.

## Onde editar

- Galeria, fotos e botões: [comoadicionarfotos.md](comoadicionarfotos.md).
- Contatos: `src/content/site.ts`; identidade: `src/styles/global.css`.
- Loja e painel: `src/components/shop/`; estilos: `src/styles/shop.css`.
- API e regras comerciais: `server/src/`; banco: `server/migrations/`.
- Mapa das responsabilidades: [arquitetura](docs/architecture.md).
- Auditoria de interação, correções e cobertura: [auditoria E2E](docs/auditoria-e2e.md).
- Fluxos, segurança e limites: [operação comercial](docs/commerce.md).
- Neon + Render + Vercel + Stripe: [publicação](docs/deployment.md).

## Verificação

Crie um banco separado chamado **qalbi_test**. Os testes limpam somente esse banco; nunca aponte para dados reais.

```sh
export TEST_DATABASE_URL='postgresql://USUARIO:SENHA@localhost:5432/qalbi_test'
npm run validate
npm audit --audit-level=high
```

`validate` verifica formatação, tipos, testes do conteúdo, integração com PostgreSQL e build. Os testes de pagamento simulam a API Stripe e verificam assinaturas reais com segredo de teste local; a homologação com uma conta Stripe é uma etapa adicional. A CI cria seu próprio PostgreSQL. `npm run format` formata o código.

## Situação da entrega

Implementação local preparada para os provedores solicitados; **não publicada** e sem credenciais de produção. Antes de vender: cadastrar catálogo real, confirmar euros/Espanha, frete, prazos, política comercial e configurar as contas. O pagamento usa uma etapa segura hospedada no Stripe e volta ao site. A confirmação vem do webhook, nunca do endereço de retorno.

Não estão incluídos nesta versão: anexos nas conversas e upload de fotos de produtos, frete por transportadora, notificações por email, redefinição automática de senha, cupons, reembolsos no painel ou impostos calculados automaticamente. Os limites e procedimentos estão documentados em `docs/commerce.md`.

A área **Página inicial** permite enviar fotos, editar e organizar os cards da home e trocar as três fotos principais, com prévia e publicação no banco. Veja [o guia de uso](comoadicionarfotos.md).
