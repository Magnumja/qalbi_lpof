import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePieces } from '../src/content/validate-pieces.ts';
import { contactUrl, site } from '../src/content/site.ts';

const piece = {
  id: 'bolsa-floral',
  title: 'Flores para llevar',
  category: 'Bordado',
  alt: 'Bolsa bordada com flores',
  description: 'Uma peça personalizada.',
  image: { src: '/bolsa.jpg', width: 800, height: 800, format: 'jpg' },
};

test('aceita catálogo vazio ou uma técnica nova com cadastro completo', () => {
  assert.doesNotThrow(() => validatePieces([]));
  assert.doesNotThrow(() =>
    validatePieces([piece, { ...piece, id: 'outra', category: 'Cerámica' }]),
  );
});
test('rejeita ids duplicados que confundiriam a identidade dos cards no React', () => {
  assert.throws(() => validatePieces([piece, { ...piece }]), /id duplicado/);
});
test('rejeita ids inválidos e campos vazios com indicação do campo', () => {
  assert.throws(
    () => validatePieces([{ ...piece, id: 'Bolsa Floral' }]),
    /id em minúsculas/,
  );
  for (const field of ['id', 'title', 'category', 'alt', 'description']) {
    assert.throws(
      () => validatePieces([{ ...piece, [field]: '  ' }]),
      new RegExp(`preencha ${field}`),
    );
  }
});
test('impede categoria reservada e espaços que criariam filtros ambíguos', () => {
  for (const category of ['Todas', 'todas', ' Bordado', 'Bordado ']) {
    assert.throws(() => validatePieces([{ ...piece, category }]), /categoria/);
  }
});
test('contato geral aponta ao número configurado, sem enviar a mensagem', () => {
  const url = new URL(contactUrl());
  assert.equal(url.origin, 'https://wa.me');
  assert.equal(url.pathname, `/${site.whatsapp}`);
  assert.match(site.whatsapp, /^[1-9][0-9]{7,14}$/);
  assert.match(url.searchParams.get('text'), /tengo una idea/);
});
test('títulos com acentos e caracteres de URL permanecem em uma única mensagem', () => {
  const title = 'Coração & flores? #1 + “amor”';
  const url = new URL(contactUrl(title));
  assert.equal(url.searchParams.size, 1);
  assert.equal(url.hash, '');
  assert.ok(url.searchParams.get('text').includes(`«${title}»`));
});
