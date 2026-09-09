# Como adicionar fotos e criar cards

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
