# Publicar no Neon, Render e Vercel

Os arquivos estão preparados, mas nenhuma conta, serviço pago ou publicação de produção foi criado nesta entrega. Use ambientes separados para homologação e produção. Não cole segredos em commits, capturas ou conversas.

## 1. Neon: PostgreSQL

Crie um projeto e banco no Neon. Copie a conexão PostgreSQL fornecida pelo painel com TLS (`sslmode=require`); a conexão com pool é adequada à API. Guarde como `DATABASE_URL` no Render. As migrations criam as tabelas na primeira inicialização. Nunca use esse banco nos testes automatizados, que apagam o conteúdo de `qalbi_test`.

Defina a política de backup/recuperação disponível na sua conta e teste uma restauração em banco separado antes de receber pedidos reais. O repositório não configura backups da conta Neon.

## 2. Vercel: frontend

Importe o repositório, com a raiz do projeto como Root Directory. Framework Astro, comando `npm run build`, saída `dist`, Node 22. A pasta `api/` contém a função que encaminha chamadas ao Render. `vercel.json` já registra a configuração.

Cadastre **BACKEND_URL** com a URL HTTPS do serviço Render e **PROXY_SECRET** com o mesmo valor configurado no Render. Não adicione prefixo `PUBLIC_`. Publique novamente após alterar variáveis da função. Não configure DATABASE_URL nem segredos Stripe no frontend.

Escolha um domínio estável. Seu endereço exato será `FRONTEND_URL` no Render, sem caminho. Um domínio alternativo deve redirecionar para o principal; origens diferentes são rejeitadas nos formulários. Previews Vercel precisam de uma API de homologação com sua própria origem e banco, sem acesso aos pedidos de produção.

## 3. Render: API

Use o Blueprint `render.yaml` na raiz, ou configure um Web Service Node:

- Build: `npm ci`
- Start: `npm run db:migrate && npm start --workspace=@qalbi/server`
- Health check: `/health`
- Node: 22.23.2; `PORT` vem do Render.

| Variável | Valor |
| --- | --- |
| `DATABASE_URL` | Conexão privada Neon com TLS |
| `FRONTEND_URL` | Origem HTTPS exata do site Vercel/domínio final |
| `NODE_ENV` | `production` |
| `STRIPE_SECRET_KEY` | Chave secreta Stripe, primeiro de teste |
| `STRIPE_WEBHOOK_SECRET` | Segredo do endpoint webhook do mesmo ambiente Stripe |
| `SHIPPING_CENTS` | Frete fixo em centavos; `0` somente se envio grátis for intencional |
| `SHIPPING_COUNTRIES` | Países ISO separados por vírgulas, inicialmente `ES` |
| `PROXY_SECRET` | Obrigatório em produção (mínimo 16 caracteres, aleatório). O mesmo valor vai na Vercel: o proxy envia o IP do visitante só com esse segredo, e a API só confia nele com o segredo. Sem isso todos os visitantes contariam como um único IP nos limites |
| `RESEND_API_KEY` | Opcional; chave do Resend para avisos por email. Configure junto com `NOTIFY_FROM` |
| `NOTIFY_FROM` | Remetente verificado no Resend, por exemplo `Qalbi Atelier <avisos@seu-dominio.com>`; exige domínio com SPF/DKIM configurados no Resend |

O blueprint usa plano gratuito para não contratar custos automaticamente. Para receber vendas, avalie e escolha na conta um serviço sempre ativo: suspensão por inatividade pode atrasar login, checkout e webhooks. O código tem timeouts e devolve erro recuperável quando o backend não responde.

As duas chaves Stripe devem ser configuradas juntas ou ficar ambas vazias. Sem elas o restante do sistema funciona, mas não há pagamento. Produção exige frete explícito e conexão TLS. Use as mesmas variáveis em todas as instâncias e não armazene fotos no disco efêmero do Render.

## 4. Administrador por variáveis de ambiente

Configure somente no backend Render:

```dotenv
ADMIN_EMAIL=seu-email-administrativo@seu-dominio.com
ADMIN_PASSWORD=SUBSTITUA_POR_UMA_SENHA_FORTE_E_EXCLUSIVA
ADMIN_NAME=Qalbi Atelier
```

O valor acima é apenas um exemplo de configuração: crie sua própria senha (mínimo 12 caracteres), nunca publique nem reutilize o texto do exemplo. Não coloque essas variáveis na Vercel, no JavaScript público ou em commits.

Ao iniciar, depois das migrations, a API cria a conta administrativa se ela não existir. O seed é idempotente e protegido por lock do PostgreSQL. Se o email já pertence a cliente, o startup recusa promovê-lo silenciosamente; escolha um email administrativo exclusivo. Se ambas as variáveis de credenciais estiverem ausentes, nenhuma conta é criada.

Entre em **`/admin/login`** com esse email e senha. O painel em `/admin` possui layout próprio, sem menu de loja ou cadastro público. Clientes não podem entrar pelo login administrativo; administradores não entram pelo formulário dos clientes. A autorização é conferida na API em toda operação.

**Reiniciar ou alterar ADMIN_PASSWORD no ambiente não redefine uma conta existente.** Depois da criação, pode remover a senha do ambiente. Para rotação/recuperação, há um comando explícito de operador. Em bash, com DATABASE_URL configurada em `server/.env` ou no ambiente:

```bash
read -r -p 'Email do administrador: ' ADMIN_EMAIL
read -r -p 'Nome do administrador: ' ADMIN_NAME
read -r -s -p 'Nova senha forte, mínimo 12 caracteres: ' ADMIN_PASSWORD
export ADMIN_EMAIL ADMIN_NAME ADMIN_PASSWORD
npm run admin --workspace=@qalbi/server
unset ADMIN_EMAIL ADMIN_NAME ADMIN_PASSWORD
```

Esse comando redefine a senha e revoga as sessões; diferentemente do seed automático, pode promover uma conta existente e só deve ser executado conscientemente pelo operador.

Cadastre produtos reais, estoque disponível, preços finais e prazo em dias corridos. Inicialmente ficam vazios: fotos institucionais não determinam preço de venda.

## 5. Stripe: homologar antes de ativar

Nesta versão, o comprador cria o pedido no site e escolhe **Pagar mi pedido**. O Checkout seguro do Stripe recebe o cartão e retorna à conta. Não é um formulário de cartão embutido na página Qalbi.

No painel Stripe, crie o destino de eventos:

```text
https://SEU-BACKEND.onrender.com/webhooks/stripe
```

Assine `checkout.session.completed`, `checkout.session.expired`, `charge.refunded` e `charge.dispute.created`. Copie o segredo desse endpoint para `STRIPE_WEBHOOK_SECRET`. O endpoint usa corpo bruto e verifica assinatura; não passa pelo proxy Vercel. O estado do pedido não depende de o cliente voltar ao site.

No ambiente Stripe de teste:

1. Cadastre produto de homologação e estoque pequeno.
2. Crie uma compra, pague com cartão de teste indicado na documentação Stripe e confira evento entregue, pedido confirmado e prazo.
3. Reenvie o mesmo evento: não deve duplicar histórico nem estoque.
4. Cancele um checkout e confira a reserva. Checkout expirado deve liberar estoque uma vez.
5. Teste encomenda: pedido, orçamento do admin, pagamento e avanço de produção.
6. Confira celular, cookies, mensagens e acesso negado a pedidos de outro cliente.
7. Em caso de webhook perdido, use **Comprobar un pago en Stripe** no pedido administrativo com o ID `cs_...`. O servidor consulta o Stripe e valida pedido, valor e moeda; não há botão para inventar confirmação de pagamento.

Só depois troque para chaves live e para o segredo do endpoint live. Nunca misture ambientes. Os testes automatizados locais não substituem essa homologação externa. Não foi realizada cobrança real nesta entrega.

## Operação, atualizações e rollback

- Configure alertas de indisponibilidade para `/health`, falhas de webhook no Stripe e erros no Render. Logs incluem identificador da requisição, sem corpo de mensagem, senha ou endereço.
- Publique mudanças compatíveis da API antes do frontend. Migrations novas precisam ser aditivas quando versões antigas ainda estiverem ativas.
- Para rollback de interface/API, restaure o deploy anterior nos provedores. Não reverta schema nem apague pedidos automaticamente. Restauração de banco exige plano separado e cuidado com pagamentos recebidos depois do backup.
- Confirme idioma, moeda, países, frete, preço final, prazo, contato e conteúdo de políticas comerciais antes da abertura. Complete metadados de domínio/canonical/social quando o domínio existir.
- Consulte [limites e operação](commerce.md), especialmente recuperação de conta, reembolso e pagamento com resposta incerta.

Referências oficiais: [Neon — conectar](https://neon.com/docs/connect/connect-from-any-app), [Render Blueprint](https://render.com/docs/blueprint-spec), [Vercel Node runtime](https://vercel.com/docs/functions/runtimes/node-js), [Stripe — fulfillment](https://docs.stripe.com/checkout/fulfillment).


## Cabeçalhos do site

`vercel.json` aplica `Content-Security-Policy` (`default-src 'self'`, imagens de qualquer origem HTTPS, `connect-src 'self'`, `frame-ancestors 'none'`, formulários só para o próprio site e o Checkout Stripe). Os scripts das ilhas do Astro são inline, por isso `script-src` ainda inclui `'unsafe-inline'`; trocar por hashes gerados no build é a próxima etapa. Após publicar, confira no console do navegador que nenhuma página registra violação de CSP.

## Registros da API

Cada requisição gera uma linha JSON no stdout do Render (`event: "request"`, método, rota com IDs substituídos por `:id`, status, duração e `request_id`; `/health` é omitido). Falhas internas geram `event: "request_failed"` com o mesmo `request_id`. Nunca são gravados corpo, cookies, endereço ou dados do Stripe. Configure no Render um alerta de indisponibilidade sobre `/health` e use o `request_id` (também devolvido no header `X-Request-Id`) para localizar uma falha relatada por um cliente.
