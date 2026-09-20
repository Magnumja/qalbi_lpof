import { expect } from '@playwright/test';
import pg from 'pg';
import { hashPassword } from '../server/src/auth.mjs';
export const password = 'senha-de-teste-e2e-2026';
export const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
});
export async function resetDatabase() {
  await pool.query(
    'TRUNCATE users,products,sessions,orders,order_items,messages,order_events,order_reads,access_links,stripe_events,rate_limits RESTART IDENTITY CASCADE',
  );
  await pool.query(
    "INSERT INTO users(name,email,password_hash,role) VALUES('Atelier E2E','admin@e2e.test',$1,'admin')",
    [await hashPassword(password)],
  );
  await pool.query(
    "INSERT INTO products(title,description,category,image_url,price_cents,kind,stock,lead_days,active) VALUES('Bolsa bordada E2E','Pieza ficticia usada solo por las pruebas automáticas.','Bordado','/shop/embroidery.jpg',2500,'ready',3,7,true)",
  );
}
export async function registerCustomer(page, name, email) {
  await page.goto('/cuenta');
  await page.getByRole('button', { name: 'Crear una cuenta' }).click();
  await page.getByLabel('Tu nombre').fill(name);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel(/^Contraseña/).fill(password);
  await page.getByRole('button', { name: 'Crear mi cuenta' }).click();
  await expect(
    page.getByRole('heading', { name: `Hola, ${name.split(' ')[0]}.` }),
  ).toBeVisible();
}
export async function loginAdmin(page) {
  await page.goto('/admin/login');
  await page.getByLabel('Email del administrador').fill('admin@e2e.test');
  await page.getByLabel(/^Contraseña/).fill(password);
  await page.getByRole('button', { name: 'Entrar al panel' }).click();
  await expect(
    page.getByRole('heading', { name: 'Todo en su sitio.' }),
  ).toBeVisible();
}
export async function fillAddress(page) {
  await page.getByLabel('Dirección completa').fill('Calle de pruebas 1');
  await page.getByLabel('Ciudad').fill('Málaga');
  await page.getByLabel('Código postal').fill('29001');
}
