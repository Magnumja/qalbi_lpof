import { useEffect, useRef, useState } from 'react';
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
  const [shared, setShared] = useState('');
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  // Endereço estável da peça: abre a loja com estes detalhes já visíveis.
  const link = `${window.location.origin}/tienda?pieza=${product.id}`;
  async function share() {
    const data = {
      title: product.title,
      text: `${product.title} · Qalbi Atelier`,
      url: link,
    };
    try {
      if (navigator.share && navigator.canShare?.(data)) {
        await navigator.share(data);
        return;
      }
      await navigator.clipboard.writeText(link);
      setShared('Enlace copiado.');
    } catch {
      setShared(link);
    }
  }
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
      <button className="shop-text-button" type="button" onClick={share}>
        Compartir esta pieza ↗
      </button>
      <p role="status" className="shop-muted">
        {shared}
      </p>
    </dialog>
  );
}
