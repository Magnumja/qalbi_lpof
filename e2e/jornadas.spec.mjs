import { test, expect } from '@playwright/test';
import sharp from 'sharp';
import {
  registerCustomer,
  loginAdmin,
  fillAddress,
  pool,
  password,
} from './helpers.mjs';

test('comprar: elegir pieza, confirmar datos y ver el pedido pendiente de pago', async ({
  page,
}) => {
  await registerCustomer(page, 'Ana Compra', 'ana@e2e.test');
  await page.goto('/tienda');
  await page.getByRole('button', { name: 'Añadir a mi selección' }).click();
  await expect(
    page.getByText('Bolsa bordada E2E añadido a tu selección.'),
  ).toBeVisible();
  await fillAddress(page);
  await page.getByRole('button', { name: 'Crear pedido y continuar' }).click();
  await expect(
    page.getByRole('heading', { name: /Pedido #\d+/ }),
  ).toBeVisible();
  await expect(page.getByText('Pendiente de pago').first()).toBeVisible();
  await expect(page.getByText('30,00 €')).toBeVisible();
});

test('encargo: la clienta cuenta su idea y el atelier envía presupuesto', async ({
  browser,
}) => {
  const cliente = await browser.newPage();
  await registerCustomer(cliente, 'Bea Encargo', 'bea@e2e.test');
  await cliente.goto('/encargo');
  await fillAddress(cliente);
  await cliente
    .getByLabel('Tu idea, ocasión y fecha deseada')
    .fill(
      'Un bordado con el nombre de mi sobrina para su bautizo en primavera.',
    );
  await cliente.getByRole('button', { name: 'Enviar mi idea' }).click();
  await expect(cliente.getByText('Solicitud recibida.')).toBeVisible();
  const number = (
    await cliente.getByRole('heading', { name: /Pedido #\d+/ }).textContent()
  ).match(/\d+/)[0];

  const atelier = await browser.newPage();
  await loginAdmin(atelier);
  await atelier
    .getByRole('button', { name: 'Por presupuestar' })
    .first()
    .click();
  await atelier
    .getByRole('button', { name: new RegExp(`#${number} · Bea Encargo`) })
    .click();
  await atelier.getByLabel('Total en €, envío incluido').fill('45');
  await atelier.getByLabel('Fecha de preparación').fill('2030-05-01');
  await atelier.getByRole('button', { name: 'Enviar presupuesto' }).click();
  await expect(atelier.getByText('Actualizado.')).toBeVisible();

  await cliente.reload();
  await expect(cliente.getByText('45,00 €').first()).toBeVisible();
  await expect(cliente.getByText('Pendiente de pago').first()).toBeVisible();
  await cliente.close();
  await atelier.close();
});

test('conversar: el mensaje nuevo se ve en el panel y la respuesta llega a la clienta', async ({
  browser,
}) => {
  const cliente = await browser.newPage();
  await cliente.goto('/cuenta');
  await cliente.getByLabel('Email o teléfono').fill('ana@e2e.test');
  await cliente.getByLabel(/^Contraseña/).fill(password);
  await cliente.getByRole('button', { name: 'Entrar', exact: true }).click();
  await cliente
    .getByRole('button', { name: /Tu selección/ })
    .first()
    .click();
  await cliente.getByLabel('Tu mensaje').fill('¿Puede llevar mis iniciales?');
  await cliente.getByRole('button', { name: 'Enviar mensaje' }).click();
  await expect(cliente.getByText('¿Puede llevar mis iniciales?')).toBeVisible();

  const atelier = await browser.newPage();
  await loginAdmin(atelier);
  await expect(
    atelier.getByRole('button', { name: /Ana Compra/ }),
  ).toContainText('1 mensaje nuevo');
  await atelier.getByRole('button', { name: /Ana Compra/ }).click();
  await expect(atelier.getByText('ana@e2e.test')).toBeVisible();
  await atelier.getByLabel('Tu mensaje').fill('Claro, dime cuáles.');
  await atelier.getByRole('button', { name: 'Enviar mensaje' }).click();
  await expect(atelier.getByText('Claro, dime cuáles.')).toBeVisible();

  await expect(cliente.getByText('Claro, dime cuáles.')).toBeVisible({
    timeout: 15000,
  });
  // La clienta adjunta una foto de referencia; el atelier la ve en la conversación.
  const buffer = await sharp({
    create: { width: 64, height: 64, channels: 3, background: '#c5a3b8' },
  })
    .png()
    .toBuffer();
  await cliente
    .getByLabel('Adjuntar una foto')
    .setInputFiles({ name: 'referencia.png', mimeType: 'image/png', buffer });
  await expect(
    cliente.getByRole('button', { name: 'Quitar foto' }),
  ).toBeVisible();
  await cliente.getByLabel('Tu mensaje').fill('Algo así.');
  await cliente.getByRole('button', { name: 'Enviar mensaje' }).click();
  await expect(
    cliente.getByAltText('Foto enviada por Ana Compra'),
  ).toBeVisible();
  await atelier.reload();
  await expect(
    atelier.getByAltText('Foto enviada por Ana Compra'),
  ).toBeVisible();
  await cliente.goto('/cuenta');
  await expect(cliente.getByText('El atelier te ha escrito')).not.toBeVisible();
  await cliente.close();
  await atelier.close();
});

test('acceso: el atelier genera un enlace y la clienta elige nueva contraseña', async ({
  browser,
}) => {
  const atelier = await browser.newPage();
  await loginAdmin(atelier);
  await atelier.getByRole('button', { name: /Bea Encargo/ }).click();
  await atelier.getByText('El cliente no puede entrar').click();
  await atelier
    .getByRole('button', { name: 'Generar enlace de acceso' })
    .click();
  const link = await atelier.getByLabel('Enlace de acceso').inputValue();
  expect(link).toMatch(/\/cuenta\?acceso=[a-f0-9]{64}$/);
  await atelier.close();

  const cliente = await browser.newPage();
  await cliente.goto(link);
  await expect(
    cliente.getByRole('heading', { name: 'Elige una nueva contraseña.' }),
  ).toBeVisible();
  await cliente
    .getByLabel('Nueva contraseña')
    .fill('otra-senha-nueva-e2e-2026');
  await cliente.getByRole('button', { name: 'Guardar y entrar' }).click();
  await expect(
    cliente.getByRole('heading', { name: 'Hola, Bea.' }),
  ).toBeVisible();
  await cliente.goto(link);
  await cliente.getByRole('button', { name: 'Salir' }).click();
  await cliente.goto(link);
  await cliente.getByLabel('Nueva contraseña').fill('tercera-senha-e2e-2026');
  await cliente.getByRole('button', { name: 'Guardar y entrar' }).click();
  await expect(cliente.getByText('Este enlace ya no es válido.')).toBeVisible();
  await cliente.close();
});

test('compartir: el enlace de una pieza abre sus detalles y avisa si ya no existe', async ({
  page,
}) => {
  const { rows } = await pool.query(
    "SELECT id FROM products WHERE title='Bolsa bordada E2E'",
  );
  await page.goto(`/tienda?pieza=${rows[0].id}`);
  await expect(
    page.getByRole('heading', { name: 'Bolsa bordada E2E', level: 2 }).last(),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Compartir esta pieza' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar detalles' }).click();
  await expect(page).toHaveURL(/\/tienda$/);
  await page.goto('/tienda?pieza=00000000-0000-4000-8000-000000000000');
  await expect(
    page.getByText('Esa pieza ya no está disponible en la tienda.'),
  ).toBeVisible();
});
test.afterAll(() => pool.end());
