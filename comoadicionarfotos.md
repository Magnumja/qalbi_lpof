# Como adicionar fotos e criar cards

## Página inicial: editar direto pelo painel

1. Entre em `/admin` e abra **Página inicial**.
2. Escolha um card na lista. Altere **nome**, **técnica**, **história e detalhes** e **descrição da foto**.
3. Em **Subir foto desde tu dispositivo**, escolha uma imagem JPG, PNG ou WebP de até 12 MB. Ela é reduzida automaticamente. Também pode informar uma URL HTTPS ou `/shop/arquivo.jpg`.
4. Use **↑ Subir / ↓ Bajar** para ordenar. Desmarque **Mostrar en la página inicial** para ocultar sem apagar. **Añadir card** cria um novo card inicialmente oculto; **Eliminar card** remove da seleção quando você publicar.
5. Abra **Vista previa de los cards** para conferir recortes, textos, filtros e detalhes.
6. Clique em **Publicar cambios**. Abra ou atualize a home para ver o resultado; não precisa compilar ou fazer deploy.

Na mesma área, **Foto de apertura**, **Historia destacada** e **Retrato del atelier** permitem trocar as três fotos principais e suas descrições de acessibilidade. Os textos das seções institucionais continuam no código; os títulos e descrições dos cards são editáveis pelo painel.

O botão de consulta de cada card acompanha o nome da criação automaticamente. Isso não cria produto nem define preço na loja: são destaques do portfólio.

**Antes de publicar:** mudanças ficam somente na aba aberta. O editor avisa ao sair sem salvar. Use **Recargar / descartar** para voltar ao conteúdo publicado. Se outra aba publicar primeiro, sua publicação é bloqueada para não sobrescrever o trabalho dela; recarregue e refaça a alteração. Até 30 cards.

Fotos enviadas ficam no PostgreSQL/Neon em WebP (até 500 KB por foto após conversão), não no disco do Render. A imagem é enviada ao banco imediatamente, mas só entra na home ao publicar. São arquivos públicos: envie somente fotos destinadas ao site. Excluir um card não apaga o arquivo da foto, pois ela pode estar em outros destaques.

A home usa o conteúdo do painel quando JavaScript e API estão disponíveis. O HTML estático original é a alternativa em caso de indisponibilidade ou JavaScript desativado; não use ocultação de cards para retirar informação confidencial. A edição publicada não precisa de redeploy, mas é necessário instalar esta versão com a migration `002_home_content.sql` uma vez.


## Produtos da loja (com preço e pedido)

Entre em `/admin` com sua conta administrativa e abra **Productos**. Preencha título, descrição, categoria, foto, preço em euros, tipo, estoque disponível e prazo em dias corridos. Marque a opção de publicação e salve. O card, o preço e o botão de adicionar são criados automaticamente em `/tienda`.

Para a foto:

1. Coloque o arquivo em `public/shop/`, por exemplo `bolsa-floral.jpg`.
2. Publique a atualização do frontend na Vercel.
3. No campo da foto do painel, informe `/shop/bolsa-floral.jpg`. Também é aceita uma URL HTTPS de imagem que você controla.

Use JPG ou WebP, idealmente até 300 KB e cerca de 1000 px de largura. As imagens dessa pasta são servidas como estão; não passam pela otimização da galeria. Não coloque arquivos na pasta `dist/` ou no disco do Render. **O painel ainda não faz upload:** o campo recebe o endereço da imagem.

Preço é o valor final de uma unidade; o frete configurado na API é somado ao pedido. Estoque significa unidades disponíveis, sem contar as já reservadas. Produtos sob encomenda usam o prazo cadastrado e dispensam estoque físico. Para retirar uma peça de venda, desmarque sua publicação: pedidos antigos continuam preservados.

## Galeria original no código (alternativa estática)

O passo a passo abaixo mantém o conteúdo estático de segurança da galeria. Depois que o painel estiver ativo, use Página inicial para alterar a seleção publicada; editar este arquivo não sobrescreve o banco. Ela usa fotos e links de WhatsApp. Para vender com pagamento, cadastre também o produto no painel conforme acima.


Você só precisa colocar a foto na pasta e cadastrar a peça em **`src/content/pieces.ts`**. A página cria o card, o filtro da técnica, a janela de detalhes e os botões de WhatsApp automaticamente.

## 1. Coloque a foto na pasta

Salve a imagem em `src/assets/photos/`. Exemplo: `bolsa-floral.jpg`.

Use nomes simples, sem espaços ou acentos. Prefira a foto original em JPG, PNG ou WebP, com boa iluminação e o objeto centralizado. Não é necessário converter para WebP: o Astro gera as versões leves ao compilar.

O card usa um recorte quadrado espelhado conforme sua coluna: canto superior esquerdo na esquerda e direito na direita. No computador, o card central tem cantos discretos. A imagem preenche esse espaço, então partes das bordas podem ficar fora do recorte. Na janela de detalhes, a foto aparece inteira. O arquivo original não é alterado.

## 2. Importe a foto

Abra `src/content/pieces.ts` e acrescente esta linha junto das outras importações no começo do arquivo:

```ts
import bolsaFloral from '../assets/photos/bolsa-floral.jpg';
```

`bolsaFloral` é o nome que você usará no cadastro. O caminho entre aspas precisa coincidir com o nome e a extensão do arquivo, inclusive letras maiúsculas.

## 3. Cadastre a peça

Dentro de `export const pieces = [`, cole o objeto abaixo antes do fechamento `] as const satisfies readonly Piece[];`. Mantenha os outros objetos e a vírgula entre eles.

```ts
  {
    id: 'bolsa-floral',
    title: 'Flores para llevar',
    category: 'Bordado',
    image: bolsaFloral,
    alt: 'Bolsa de tela clara con pequeñas flores bordadas en tonos malva',
    description:
      'Una bolsa bordada con pequeños detalles florales. Cuéntame qué colores y motivos te gustaría incluir en la tuya.',
  },
```

| Campo | O que preencher |
| --- | --- |
| `id` | Identificador único, sem espaços. Não repita o de outra peça. |
| `title` | Nome que aparece no card, nos detalhes e na mensagem de WhatsApp. |
| `category` | Técnica. Hoje usamos `Bordado`, `Ganchillo` e `Ilustración`. |
| `image` | Nome da importação do passo 2, **sem aspas**. |
| `alt` | Descrição objetiva do que a foto mostra, para acessibilidade. |
| `description` | Texto que aparece quando a pessoa abre os detalhes da peça. |

Os textos visíveis estão em espanhol para acompanhar o idioma atual da página. A posição do objeto na lista determina a posição do card. Para reorganizar, mova o objeto inteiro.

Uma categoria nova cria um filtro automaticamente. Use sempre a mesma grafia: `Bordado` e `bordado` seriam categorias diferentes. `Todas` é reservado ao filtro que mostra a galeria inteira.

## 4. Como o botão fica certo?

Não precisa copiar botão nem link. Cada card recebe um link para consultar a peça por WhatsApp (com o texto “WhatsApp” no celular e uma seta no computador) e a janela de detalhes recebe o botão **“Quiero una pieza así”**.

Ambos usam o `title` para montar uma mensagem como:

> Hola, me interesa «Flores para llevar». Me gustaría saber si se puede personalizar.

O número e o modelo da mensagem ficam em `src/content/site.ts`. Para trocar o número, altere `whatsapp`, mantendo código do país + número, somente dígitos, sem `+`, espaços ou parênteses. A função `contactUrl` cuida da formatação do link, inclusive acentos. O visitante revisa e envia a mensagem no WhatsApp.

## 5. Veja a alteração

No terminal, dentro da pasta do projeto:

```sh
npm run dev
```

Abra http://127.0.0.1:4321/#creaciones. Ao salvar o cadastro, a prévia de desenvolvimento atualiza automaticamente. Se o terminal indicar outra porta, use o endereço mostrado nele.

A prévia em **4322** mostra a última compilação. Para atualizá-la:

```sh
npm run check
npm run build
npx astro preview stop
npm run preview -- --port 4322
```

Atualize a aba do navegador depois. Confira a foto no celular e no computador, o filtro, os detalhes e o título na mensagem de contato.

## Trocar ou remover uma peça

- **Trocar só a foto:** substitua o arquivo mantendo o nome, ou importe outro arquivo e atualize `image` no cadastro.
- **Remover um card:** apague seu objeto completo. Apague também a importação se nenhuma outra peça usar aquela foto.
- **Alterar textos:** edite `title`, `alt` ou `description`. O botão acompanha o título automaticamente.
- **Ajustar o recorte de toda a galeria:** em `src/styles/gallery.css`, procure `.piece-image`. `aspect-ratio: 1` deixa quadrado; As regras com nth-child espelham os cantos por coluna: três colunas no computador e duas no celular.

## Se algo não aparecer

Confira o nome do arquivo, a extensão, a importação e a vírgula entre os objetos. Verifique se o filtro selecionado inclui a técnica da peça nova. Se estiver na porta 4322, compile novamente. Edite os arquivos de `src/`; a pasta `dist/` é gerada automaticamente e suas alterações seriam substituídas.

Para cadastrar peças, não é necessário editar `CreationGallery.tsx`. Esse componente cuida dos filtros, das animações e dos detalhes. `Creations.astro` prepara as versões otimizadas das imagens.

O build agora verifica o cadastro automaticamente: IDs duplicados, campos vazios e a categoria reservada Todas interrompem a compilação com uma mensagem indicando a peça. Antes de entregar uma alteração, rode `npm run validate`.
