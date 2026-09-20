import type { Product } from './types';
/** Recupera só IDs e quantidades válidas; preço e estoque vêm do catálogo atual. */
export function reconcileCart(
  value: unknown,
  products: Product[],
): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: Record<string, number> = {};
  for (const p of products) {
    const quantity = (value as Record<string, unknown>)[p.id];
    if (typeof quantity !== 'number' || !Number.isFinite(quantity)) continue;
    const available = p.kind === 'ready' ? Math.min(20, p.stock) : 20;
    const count = Math.min(available, Math.max(0, Math.floor(quantity)));
    if (count > 0) result[p.id] = count;
  }
  return result;
}
