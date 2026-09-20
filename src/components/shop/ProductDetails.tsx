import { useEffect, useRef } from 'react';
import type { Product } from './types';
import { money } from './api';
export default function ProductDetails({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="shop-piece-dialog"
      aria-labelledby="shop-piece-title"
      onClose={onClose}
    >
      <button
        className="shop-text-button"
        autoFocus
        onClick={() => dialog.current?.close()}
      >
        Cerrar detalles ×
      </button>
      <img
        src={product.image_url}
        alt={product.title}
        width={480}
        height={480}
      />
      <h2 id="shop-piece-title">{product.title}</h2>
      <p>{product.description}</p>
      <p>
        <strong>{money(product.price_cents)}</strong> · Preparación de hasta{' '}
        {product.lead_days} días después del pago.
      </p>
      <p className="shop-muted">
        El tiempo de transporte se suma a la preparación. Cierra esta ventana
        para añadir la pieza a tu selección.
      </p>
    </dialog>
  );
}
