import { useEffect, useState } from 'react';
import { reconcileCart } from './cart';
import type { Product } from './types';
const storageKey = 'qalbi-cart-v1';
export function useCart(products: Product[]) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      setCart(
        reconcileCart(
          JSON.parse(sessionStorage.getItem(storageKey) || '{}'),
          products,
        ),
      );
    } catch {
      setCart({});
    }
    setReady(true);
  }, [products]);
  useEffect(() => {
    if (!ready) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(cart));
    } catch {
      /* Navegação continua mesmo com armazenamento bloqueado. */
    }
  }, [cart, ready]);
  function change(id: string, quantity: number) {
    setCart((current) =>
      reconcileCart({ ...current, [id]: quantity }, products),
    );
  }
  function clear() {
    setCart({});
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      /* Sem armazenamento disponível. */
    }
  }
  return { cart, change, clear, ready };
}
