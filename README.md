# Qalbi Atelier

Landing page comercial em espanhol, com identidade original da marca, fotografias reais, galeria por técnica e atendimento por WhatsApp.

## Rodar e editar

Requer Node.js 22.12.0 ou superior; validado aqui com Node 22.23.2.

```sh
npm ci
npm run dev
```

A página fica em http://127.0.0.1:4321. O Astro pode manter o servidor em segundo plano. Para reiniciar após uma alteração de configuração:

```sh
npx astro dev stop
npm run dev
```

Verificações e prévia da compilação:

```sh
npm run check
npm run build
npm run preview -- --port 4322
```

## Onde alterar

- Contato, Instagram e descrição: `src/content/site.ts`.
- Criações, técnicas, descrições e importação de fotos: `src/content/pieces.ts`.
- Fotos originais usadas na página: `src/assets/photos/`.
- Cores, fontes e estilos compartilhados: `src/styles/global.css`.
- Abertura e menu: `src/components/Hero.astro` e `Header.astro`.
- Galeria e seus detalhes: `src/components/CreationGallery.tsx` e `src/styles/gallery.css`.
- História e apresentação: `src/components/Atelier.astro`.
- Processo de encomenda: `src/components/Process.astro`.
- Dúvidas e convite final: `src/components/Closing.astro`.
- Rodapé e contato móvel: `src/components/Footer.astro`.

## Arquitetura

Astro gera HTML estático. Apenas a galeria usa React, carregado quando se aproxima da área visível. O menu e o FAQ usam `details`; links de contato funcionam mesmo sem JavaScript. Imagens são geradas em WebP e fontes são locais. As animações usam CSS e Web Animations API, respeitando a preferência por movimento reduzido.

Nenhum formulário é enviado automaticamente. Os botões abrem uma mensagem editável no WhatsApp; cabe ao visitante enviá-la. Não há banco de dados, cookies de analytics, rastreamento ou checkout.

## Antes de publicar

Esta é uma versão local revisável. Confirmar com a responsável o texto em primeira pessoa, os nomes editoriais das peças, o número de WhatsApp, o idioma e a operação de entrega. Substituir miniaturas por originais em alta resolução quando possível.

Depois de definir o domínio, completar canonical, sitemap, imagem social com URL absoluta e informações legais aplicáveis à operação real. Nenhum domínio fictício foi configurado. Não há preços, prazos fixos, estoque ou depoimentos inventados. Os testes documentados em `docs/qa.md` não substituem uma revisão em telefone físico.

Documentos: `tasks/plan.md`, `tasks/todo.md`, `docs/assets.md`, `docs/qa.md`.
