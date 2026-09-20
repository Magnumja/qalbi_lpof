import { useEffect, useState } from 'react';
import { api, money } from './api';
import type { Product } from './types';
export default function AdminProducts({
  onDirty,
}: {
  onDirty: (dirty: boolean) => void;
}) {
  const [dirty, setDirty] = useState(false);
  function markDirty(value: boolean) {
    setDirty(value);
    onDirty(value);
  }
  function canLeave() {
    return (
      !dirty ||
      window.confirm('¿Descartar los cambios de esta pieza sin guardar?')
    );
  }
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const [products, setProducts] = useState<Product[]>([]),
    [editing, setEditing] = useState<Product | null>(null),
    [formKey, setFormKey] = useState(0),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  useEffect(() => {
    api<{ products: Product[] }>('/admin/products')
      .then((data) => setProducts(data.products))
      .catch((err) => setError(err.message));
  }, []);
  return (
    <section>
      <div className="shop-toolbar">
        <h2>Las piezas de la tienda</h2>
        <button
          className="shop-text-button"
          onClick={() => {
            if (!canLeave()) return;
            markDirty(false);
            setEditing(null);
            setFormKey(formKey + 1);
          }}
        >
          ＋ Nueva pieza
        </button>
      </div>
      <p>
        Publica solo piezas con precio, disponibilidad y plazo confirmados. El
        stock representa unidades disponibles, descontando las reservadas.
      </p>
      <div className="admin-product-layout">
        <div className="admin-product-list">
          {products.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                if (!canLeave()) return;
                markDirty(false);
                setEditing(p);
                setFormKey(formKey + 1);
              }}
            >
              <img src={p.image_url} alt="" width={64} height={64} />
              <span>
                {p.title}
                <small>
                  {money(p.price_cents)} · {p.active ? 'Publicado' : 'Borrador'}{' '}
                  · {p.stock} disponibles
                </small>
              </span>
              <span>↗</span>
            </button>
          ))}
        </div>
        <form
          key={formKey}
          className="admin-form"
          onChange={() => markDirty(true)}
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            setNotice('');
            const f = new FormData(e.currentTarget);
            const body = {
              title: f.get('title'),
              description: f.get('description'),
              category: f.get('category'),
              image_url: f.get('image'),
              price_cents: Math.round(Number(f.get('price')) * 100),
              kind: f.get('kind'),
              stock: Number(f.get('stock')),
              lead_days: Number(f.get('days')),
              active: f.get('active') === 'on',
              ...(editing ? { expected_stock: editing.stock } : {}),
            };
            try {
              const saved = await api<{ product: Product }>(
                editing ? `/admin/products/${editing.id}` : '/admin/products',
                editing ? 'PUT' : 'POST',
                body,
              );
              setEditing(saved.product);
              setProducts((current) =>
                editing
                  ? current.map((p) =>
                      p.id === saved.product.id ? saved.product : p,
                    )
                  : [saved.product, ...current],
              );
              markDirty(false);
              setNotice('Pieza guardada.');
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2>{editing ? 'Editar pieza' : 'Una nueva creación'}</h2>
          <label>
            Nombre
            <input
              name="title"
              required
              minLength={2}
              maxLength={150}
              defaultValue={editing?.title}
            />
          </label>
          <label>
            Descripción
            <textarea
              name="description"
              required
              minLength={10}
              maxLength={4000}
              rows={4}
              defaultValue={editing?.description}
            />
          </label>
          <label>
            Técnica o categoría
            <input
              name="category"
              required
              minLength={2}
              maxLength={60}
              defaultValue={editing?.category ?? 'Bordado'}
            />
          </label>
          <label>
            Imagen (URL HTTPS o archivo del sitio)
            <input
              name="image"
              required
              defaultValue={editing?.image_url ?? '/shop/embroidery.jpg'}
            />
            <small>
              También puedes usar /shop/panda.jpg, /shop/wedding.jpg o una URL
              HTTPS de tu alojamiento de fotos.
            </small>
          </label>
          <div className="shop-form-row">
            <label>
              Precio en €
              <input
                name="price"
                type="number"
                min={1}
                max={10000}
                step="0.01"
                required
                defaultValue={editing ? editing.price_cents / 100 : undefined}
              />
            </label>
            <label>
              Preparación (días)
              <input
                name="days"
                type="number"
                min={1}
                max={365}
                required
                defaultValue={editing?.lead_days ?? 7}
              />
            </label>
          </div>
          <label>
            Tipo
            <select name="kind" defaultValue={editing?.kind ?? 'made_to_order'}>
              <option value="made_to_order">Hecho bajo pedido</option>
              <option value="ready">Listo para enviar</option>
            </select>
          </label>
          <label>
            Unidades disponibles
            <input
              name="stock"
              type="number"
              min={0}
              max={10000}
              required
              defaultValue={editing?.stock ?? 0}
            />
            <small>
              Solo limita la compra de las piezas listas para enviar.
            </small>
          </label>
          <label className="shop-checkbox">
            <input
              type="checkbox"
              name="active"
              defaultChecked={editing?.active ?? false}
            />{' '}
            Publicar en la tienda
          </label>
          {error && (
            <p role="alert" className="shop-error">
              {error}
            </p>
          )}
          <p role="status">{notice}</p>
          <button className="button" disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar pieza'}
          </button>
        </form>
      </div>
    </section>
  );
}
