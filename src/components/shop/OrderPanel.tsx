import { useEffect, useState } from 'react';
import { api, date, money, statusLabel } from './api';
import type { OrderDetail } from './types';
export default function OrderPanel({
  id,
  admin,
  paymentEnabled,
  onBack,
}: {
  id: string;
  admin: boolean;
  paymentEnabled: boolean;
  onBack: () => void;
}) {
  const [detail, setDetail] = useState<OrderDetail | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [notice, setNotice] = useState('');
  useEffect(() => {
    let active = true;
    const load = async () => {
      if (document.hidden) return;
      try {
        const data = await api<OrderDetail>(`/orders/${id}`);
        if (active) setDetail(data);
      } catch (err) {
        if (active) setError((err as Error).message);
      }
    };
    void load();
    const timer = setInterval(() => void load(), 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [id]);
  async function action(path: string, body?: unknown, method = 'POST') {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api(path, method, body);
      setDetail(await api<OrderDetail>(`/orders/${id}`));
      setNotice('Actualizado.');
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  if (!detail)
    return (
      <>
        <button onClick={onBack} className="shop-text-button">
          ← Volver
        </button>
        <p role="status">{error || 'Cargando tu pedido…'}</p>
      </>
    );
  const { order, items, messages, events } = detail;
  return (
    <section className="order-panel">
      <button onClick={onBack} className="shop-text-button">
        ← Todos los pedidos
      </button>
      <div className="order-heading">
        <div>
          <p className="eyebrow">
            {order.kind === 'custom'
              ? 'Encargo personalizado'
              : 'Tu selección Qalbi'}
          </p>
          <h1>Pedido #{order.number}</h1>
          <p>
            {date(order.created_at)}
            {admin ? ` · ${order.customer_name}` : ''}
          </p>
        </div>
        <span className={`order-badge status-${order.status}`}>
          {statusLabel[order.status]}
        </span>
      </div>
      {error && (
        <p role="alert" className="shop-error">
          {error}
        </p>
      )}
      <p role="status" className="shop-notice">
        {notice}
      </p>
      <div className="order-columns">
        <div>
          <div className="order-summary">
            <p>
              Pago <strong>{statusLabel[order.payment_status]}</strong>
            </p>
            <p>
              Preparado para <strong>{date(order.due_at)}</strong>
            </p>
            <p>
              Total{' '}
              {order.total_cents !== null ? (
                <strong>{money(order.total_cents)}</strong>
              ) : (
                <strong>Por presupuestar</strong>
              )}
            </p>
            {order.tracking && <p>Seguimiento: {order.tracking}</p>}
          </div>
          {items.map((item) => (
            <p className="order-item" key={item.id}>
              {item.quantity} × {item.title}
              <strong>{money(item.quantity * item.price_cents)}</strong>
            </p>
          ))}
          {order.brief && (
            <div className="order-brief">
              <h2>Tu idea</h2>
              <p>{order.brief}</p>
            </div>
          )}
          <div className="order-address">
            <h2>Entrega</h2>
            <p>
              {order.address.name}
              <br />
              {order.address.line1}
              <br />
              {order.address.postal_code} · {order.address.city}
              <br />
              {order.address.country}
            </p>
          </div>
          {!admin && order.status === 'requested' && (
            <p className="order-next-step">
              Solicitud recibida. El atelier te enviará aquí el presupuesto y el
              plazo. Todavía no tienes que pagar; puedes concretar los detalles
              en la conversación.
            </p>
          )}
          {!admin && order.status === 'awaiting_payment' && !paymentEnabled && (
            <p className="order-next-step">
              Tu pedido está guardado. El pago online todavía no está
              disponible; habla con el atelier en la conversación antes de
              continuar.
            </p>
          )}
          {!admin && paymentEnabled && order.status === 'awaiting_payment' && (
            <>
              <button
                className="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError('');
                  try {
                    const result = await api<{ url: string }>(
                      `/orders/${id}/checkout`,
                      'POST',
                    );
                    window.location.assign(result.url);
                  } catch (err) {
                    setError((err as Error).message);
                    setBusy(false);
                  }
                }}
              >
                {busy ? 'Preparando el pago…' : 'Pagar mi pedido'} ↗
              </button>
              <p className="shop-muted">
                Pago seguro con tarjeta en Stripe. El estado se actualizará
                después de confirmar el pago.
              </p>
            </>
          )}
          {['requested', 'awaiting_payment'].includes(order.status) && (
            <button
              className="shop-text-button"
              disabled={busy}
              onClick={() => {
                if (window.confirm('¿Cancelar este pedido?'))
                  void action(`/orders/${id}/cancel`);
              }}
            >
              Cancelar pedido
            </button>
          )}
          {admin && order.status === 'requested' && (
            <form
              className="admin-form"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void action(`/admin/orders/${id}/quote`, {
                  total_cents: Math.round(Number(f.get('total')) * 100),
                  due_at: f.get('due'),
                });
              }}
            >
              <h2>Preparar presupuesto</h2>
              <label>
                Total en €, envío incluido
                <input
                  name="total"
                  type="number"
                  step="0.01"
                  min="1"
                  max="20000"
                  required
                />
              </label>
              <label>
                Fecha de preparación
                <input
                  type="date"
                  name="due"
                  required
                  min={new Date().toISOString().slice(0, 10)}
                />
              </label>
              <button className="button" disabled={busy}>
                Enviar presupuesto
              </button>
            </form>
          )}
          {admin && order.status === 'awaiting_payment' && (
            <details className="order-history">
              <summary>Comprobar un pago en Stripe</summary>
              <form
                className="admin-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void action(`/admin/orders/${id}/reconcile`, {
                    session_id: new FormData(e.currentTarget).get('session_id'),
                  });
                }}
              >
                <p>
                  Si la confirmación no llegó, copia el identificador de la
                  sesión Checkout desde Stripe. Verificaremos el importe y el
                  pedido.
                </p>
                <label>
                  ID de sesión de Stripe
                  <input
                    name="session_id"
                    placeholder="cs_…"
                    required
                    maxLength={255}
                  />
                </label>
                <button className="button" disabled={busy}>
                  Consultar pago
                </button>
              </form>
            </details>
          )}
          {admin &&
            order.payment_status === 'paid' &&
            order.status !== 'cancelled' && (
              <form
                className="admin-form"
                key={`${order.status}-${order.due_at}`}
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void action(
                    `/admin/orders/${id}`,
                    {
                      status: f.get('status'),
                      due_at: f.get('due') || null,
                      tracking: f.get('tracking'),
                    },
                    'PATCH',
                  );
                }}
              >
                <h2>En el atelier</h2>
                <label>
                  Estado
                  <select name="status" defaultValue={order.status}>
                    {[
                      'confirmed',
                      'in_progress',
                      'ready',
                      'shipped',
                      'completed',
                    ].map((s) => (
                      <option value={s} key={s}>
                        {statusLabel[s]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Fecha de preparación
                  <input
                    type="date"
                    name="due"
                    defaultValue={order.due_at?.slice(0, 10) ?? ''}
                  />
                </label>
                <label>
                  Seguimiento o referencia de envío
                  <input
                    name="tracking"
                    maxLength={300}
                    defaultValue={order.tracking}
                  />
                </label>
                <button className="button" disabled={busy}>
                  Guardar avance
                </button>
                <small>
                  Avanza una etapa cada vez. El pago se confirma
                  automáticamente.
                </small>
              </form>
            )}
          <details className="order-history">
            <summary>Historia del pedido</summary>
            <ol>
              {events.map((event, i) => (
                <li key={i}>
                  <small>{date(event.created_at)}</small>
                  <p>{event.description}</p>
                </li>
              ))}
            </ol>
          </details>
        </div>
        <section className="order-chat">
          <p className="eyebrow">Hablemos aquí</p>
          <h2>
            {admin
              ? 'Conversación con el cliente'
              : 'Al otro lado, el atelier.'}
          </h2>
          <p className="shop-muted">
            Últimos 200 mensajes · se actualiza cada 10 segundos mientras estás
            aquí.
          </p>
          <div
            className="chat-messages"
            role="log"
            aria-label="Mensajes del pedido"
            aria-live="polite"
          >
            {messages.length === 0 ? (
              <p>
                Todavía no hay mensajes. Este es tu espacio para preguntar y
                concretar los detalles.
              </p>
            ) : (
              messages.map((m) => (
                <article
                  className={`chat-message ${m.sender_role === 'admin' ? 'from-atelier' : ''}`}
                  key={m.id}
                >
                  <strong>
                    {m.sender_role === 'admin'
                      ? 'Qalbi Atelier'
                      : m.sender_name}
                  </strong>
                  <p>{m.body}</p>
                  <time dateTime={m.created_at}>
                    {new Date(m.created_at).toLocaleString('es-ES', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </time>
                </article>
              ))
            )}
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (await action(`/orders/${id}/messages`, { body: message }))
                setMessage('');
            }}
          >
            <label htmlFor="chat-message">Tu mensaje</label>
            <textarea
              id="chat-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              required
              maxLength={4000}
            />
            <button className="button" disabled={busy || !message.trim()}>
              Enviar mensaje ↗
            </button>
          </form>
        </section>
      </div>
    </section>
  );
}
