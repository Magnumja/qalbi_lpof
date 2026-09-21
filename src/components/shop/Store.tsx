import { useEffect, useState } from 'react';
import { api, money } from './api';
import type { ShopData, User, Order, Product } from './types';
import AddressFields, { readAddress } from './AddressFields';
import AuthForm from './AuthForm';
import ProductDetails from './ProductDetails';
import { useCart } from './useCart';
export default function Store({
  shop,
  user,
  onLogin,
  custom = false,
}: {
  shop: ShopData;
  user: User | null;
  onLogin: (user: User) => void;
  custom?: boolean;
}) {
  const [category, setCategory] = useState('Todas'),
    [selected, setSelected] = useState<Product | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const {
    cart,
    change: changeCart,
    clear: clearCart,
    ready: cartReady,
  } = useCart(shop.products);
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  // /tienda?pieza=ID abre os detalhes de um link compartilhado.
  useEffect(() => {
    if (custom) return;
    const id = new URLSearchParams(window.location.search).get('pieza');
    const piece = id && shop.products.find((p) => p.id === id);
    if (piece) setSelected(piece);
    else if (id) setNotice('Esa pieza ya no está disponible en la tienda.');
  }, [custom, shop.products]);
  const [notice, setNotice] = useState('');
  const lines = shop.products.filter((p) => cart[p.id] > 0),
    subtotal = lines.reduce((n, p) => n + p.price_cents * cart[p.id], 0);
  const change = (id: string, quantity: number) => {
    changeCart(id, quantity);
    setRequestKey(crypto.randomUUID());
  };
  async function submit(form: HTMLFormElement) {
    setBusy(true);
    setError('');
    const fields = new FormData(form);
    try {
      const result = await api<{ order: Order }>(
        custom ? '/orders/custom' : '/orders',
        'POST',
        {
          request_key: requestKey,
          address: readAddress(fields),
          brief: String(fields.get('brief') ?? ''),
          ...(custom
            ? {}
            : {
                items: lines.map((p) => ({
                  product_id: p.id,
                  quantity: cart[p.id],
                })),
              }),
        },
      );
      if (!custom) clearCart();
      window.location.assign(`/cuenta?order=${result.order.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <header className="shop-heading">
        <p className="eyebrow">Qalbi · pequeñas cosas, mucho significado</p>
        <h1>
          {custom ? (
            <>
              Primero, <em>tu idea.</em>
            </>
          ) : (
            <>
              Hecho con calma.
              <br />
              <em>Elegido por ti.</em>
            </>
          )}
        </h1>
        <p>
          {custom
            ? 'Cuéntame qué imaginas. Te enviaré aquí el presupuesto y el plazo, antes de pagar.'
            : 'Bordado, ganchillo e ilustración para regalar, recordar y acompañarte.'}
        </p>
      </header>
      {!custom && (
        <>
          <div className="shop-toolbar">
            <div
              className="gallery-filters"
              role="group"
              aria-label="Categorías"
            >
              {['Todas', ...new Set(shop.products.map((p) => p.category))].map(
                (c) => (
                  <button
                    key={c}
                    aria-pressed={category === c}
                    onClick={() => setCategory(c)}
                  >
                    {c}
                  </button>
                ),
              )}
            </div>
            {lines.length > 0 && (
              <a href="#pedido">
                Tu selección ({Object.values(cart).reduce((a, b) => a + b, 0)})
                ↓
              </a>
            )}
          </div>
          {shop.products.length === 0 ? (
            <div className="shop-empty">
              <span aria-hidden="true">✳</span>
              <h2>Algo bonito está en camino.</h2>
              <p>
                Estoy preparando la selección de la tienda. Mientras tanto,
                podemos crear algo especial para ti.
              </p>
              <a className="button" href="/encargo">
                Contar mi idea ↗
              </a>
            </div>
          ) : (
            <div className="shop-products">
              {shop.products
                .filter((p) => category === 'Todas' || p.category === category)
                .map((p) => (
                  <article className="shop-product" key={p.id}>
                    <button
                      className="shop-product-photo"
                      onClick={() => setSelected(p)}
                      aria-label={`Ver ${p.title}`}
                    >
                      <img
                        src={p.image_url}
                        alt={p.title}
                        loading="lazy"
                        width="480"
                        height="480"
                      />
                      <span>
                        {p.kind === 'ready'
                          ? 'Listo para enviar'
                          : 'Hecho para ti'}
                      </span>
                    </button>
                    <div className="shop-product-title">
                      <h2>{p.title}</h2>
                      <strong>{money(p.price_cents)}</strong>
                    </div>
                    <p className="shop-muted">
                      Preparación: hasta {p.lead_days}{' '}
                      {p.lead_days === 1 ? 'día' : 'días'} · {p.category}
                    </p>
                    <button
                      className="shop-add"
                      disabled={
                        !cartReady ||
                        (p.kind === 'ready' && p.stock <= (cart[p.id] ?? 0)) ||
                        cart[p.id] >= 20
                      }
                      onClick={() => {
                        change(p.id, (cart[p.id] ?? 0) + 1);
                        setNotice(`Has añadido «${p.title}» a tu selección.`);
                      }}
                    >
                      {p.kind === 'ready' && p.stock === 0
                        ? 'Agotado'
                        : 'Añadir a mi selección'}{' '}
                      <span aria-hidden="true">＋</span>
                    </button>
                  </article>
                ))}
            </div>
          )}
          <p role="status" className="shop-notice">
            {notice}
          </p>
          {selected && (
            <ProductDetails
              key={selected.id}
              product={selected}
              onClose={() => {
                setSelected(null);
                if (window.location.search.includes('pieza='))
                  window.history.replaceState(null, '', '/tienda');
              }}
            />
          )}
        </>
      )}
      {(custom || lines.length > 0) && (
        <section id="pedido" className="shop-checkout">
          <div>
            <p className="eyebrow">
              {custom ? 'Un encargo con tu historia' : 'Tu selección'}
            </p>
            <h2>
              {custom ? 'Lo imaginamos juntas.' : 'Un poquito más cerca.'}
            </h2>
            <ol className="shop-steps" aria-label="Cómo funciona">
              <li>{custom ? 'Cuenta tu idea' : 'Elige tus piezas'}</li>
              <li>
                {custom ? 'Recibe presupuesto y plazo' : 'Confirma tus datos'}
              </li>
              <li>
                {custom ? 'Paga cuando aceptes' : 'Paga y sigue tu pedido'}
              </li>
            </ol>
            {!custom && (
              <>
                <ul className="cart-lines">
                  {lines.map((p) => (
                    <li key={p.id}>
                      <div>
                        <strong>{p.title}</strong>
                        <span>{money(p.price_cents * cart[p.id])}</span>
                      </div>
                      <label>
                        Unidades
                        <input
                          type="number"
                          min={1}
                          max={p.kind === 'ready' ? Math.min(20, p.stock) : 20}
                          value={cart[p.id]}
                          onChange={(e) =>
                            change(
                              p.id,
                              Math.max(
                                1,
                                Math.min(20, Number(e.target.value) || 1),
                              ),
                            )
                          }
                        />
                      </label>
                      <button
                        className="shop-text-button"
                        aria-label={`Quitar ${p.title}`}
                        onClick={() => change(p.id, 0)}
                      >
                        Quitar
                      </button>
                    </li>
                  ))}
                </ul>
                <p>
                  Subtotal <strong>{money(subtotal)}</strong>
                </p>
                <p>
                  Envío <strong>{money(shop.shipping_cents)}</strong>
                </p>
                <p className="cart-total">
                  Total <strong>{money(subtotal + shop.shipping_cents)}</strong>
                </p>
                {!shop.payment_enabled && (
                  <p className="order-next-step">
                    El pago en línea aún no está habilitado. Puedes guardar tu
                    pedido y hablar con el atelier antes de pagar.
                  </p>
                )}
                <p className="shop-muted">
                  El precio y la disponibilidad se confirman al crear el pedido.
                  El tiempo de transporte se suma a la preparación.
                </p>
              </>
            )}
          </div>
          <div>
            {!user ? (
              <AuthForm onLogin={onLogin} />
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void submit(e.currentTarget);
                }}
                onChange={() => setRequestKey(crypto.randomUUID())}
              >
                <AddressFields name={user.name} countries={shop.countries} />
                <label>
                  {custom
                    ? 'Tu idea, ocasión y fecha deseada'
                    : '¿Quieres contarme algo?'}
                  <textarea
                    name="brief"
                    rows={5}
                    required={custom}
                    minLength={custom ? 20 : 0}
                    maxLength={4000}
                  />
                </label>
                <p className="shop-muted">
                  Usaré estos datos para preparar y entregar tu pedido. Puedes
                  hablar con el atelier desde tu cuenta.
                </p>
                {error && (
                  <p role="alert" className="shop-error">
                    {error}
                  </p>
                )}
                <button className="button" disabled={busy}>
                  {busy
                    ? 'Guardando…'
                    : custom
                      ? 'Enviar mi idea'
                      : 'Crear pedido y continuar'}{' '}
                  ↗
                </button>
              </form>
            )}
          </div>
        </section>
      )}
    </>
  );
}
