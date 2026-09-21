import { useEffect, useState } from 'react';
import { api, date, money, statusLabel } from './api';
import type { Order, User } from './types';
import OrderPanel from './OrderPanel';
import ContactSettings from './ContactSettings';
import NotificationSettings from './NotificationSettings';
import SessionSettings from './SessionSettings';
import AdminProducts from './AdminProducts';
import AdminHome from '../home/AdminHome';
import AdminGuide from '../admin/AdminGuide';
export default function Account({
  user,
  admin = false,
  paymentEnabled = false,
  notificationsEnabled = false,
}: {
  user: User;
  admin?: boolean;
  paymentEnabled?: boolean;
  notificationsEnabled?: boolean;
}) {
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('priority');
  const [hasMore, setHasMore] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [editorDirty, setEditorDirty] = useState(false);
  function switchTab(next: string) {
    if (
      (tab === 'home' || tab === 'products') &&
      editorDirty &&
      !window.confirm('¿Salir sin guardar los cambios de esta sección?')
    )
      return false;
    setEditorDirty(false);
    setTab(next);
    return true;
  }
  const [orders, setOrders] = useState<Order[]>([]),
    [selected, setSelected] = useState<string | null>(null),
    [tab, setTab] = useState('orders'),
    [error, setError] = useState(''),
    [page, setPage] = useState(0),
    [filter, setFilter] = useState('all'),
    [stats, setStats] = useState({
      requested: 0,
      awaiting_payment: 0,
      active: 0,
      overdue: 0,
      unread: 0,
    }),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('order');
    if (id && /^[a-f0-9-]{36}$/.test(id)) setSelected(id);
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api<{ orders: Order[]; stats?: typeof stats; has_more?: boolean }>(
      admin
        ? `/admin/orders?${new URLSearchParams({ page: String(page), filter, search, sort })}`
        : '/orders',
    )
      .then((data) => {
        if (active) {
          setOrders(data.orders);
          setHasMore(data.has_more ?? false);
          if (data.stats) setStats(data.stats);
        }
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [admin, page, filter, search, sort, selected, tab, refresh]);
  const filterLabel: Record<string, string> = {
    requested: 'Por presupuestar',
    awaiting_payment: 'Pendientes de pago',
    active: 'En preparación',
    overdue: 'Revisar plazo',
    unread: 'Conversaciones con mensajes nuevos',
    completed: 'Enviados y completados',
    cancelled: 'Cancelados',
  };
  function toggleFilter(next: string) {
    setPage(0);
    setFilter(filter === next ? 'all' : next);
  }
  const sectionHeading: Record<string, [string, string]> = {
    orders: [
      'Pedidos y plazos',
      'Revisa prioridades, organiza entregas y acompaña cada creación.',
    ],
    products: [
      'Catálogo de piezas',
      'Fotos, precios y disponibilidad: todo listo para tu próxima venta.',
    ],
    home: [
      'La primera impresión',
      'Cuida las imágenes y las historias que dan la bienvenida al atelier.',
    ],
    guide: [
      'Tu guía de trabajo',
      'Instrucciones sencillas para gestionar el atelier con confianza.',
    ],
  };
  const unreadTotal = orders.reduce((n, o) => n + (o.unread_count ?? 0), 0);
  if (admin && user.role !== 'admin')
    return (
      <div className="shop-empty">
        <h1>Tu espacio es por aquí.</h1>
        <a href="/cuenta" className="button">
          Ver mis pedidos
        </a>
      </div>
    );
  if (selected)
    return (
      <OrderPanel
        key={selected}
        id={selected}
        admin={admin}
        paymentEnabled={paymentEnabled}
        onBack={() => {
          setSelected(null);
          window.history.replaceState(null, '', admin ? '/admin' : '/cuenta');
        }}
      />
    );
  return (
    <>
      <header className="shop-heading compact">
        <p className="eyebrow">{admin ? 'Central del atelier' : 'Mi cuenta'}</p>
        <h1>
          {admin ? sectionHeading[tab][0] : `Hola, ${user.name.split(' ')[0]}.`}
        </h1>
        <p>
          {admin
            ? sectionHeading[tab][1]
            : 'Tus piezas, sus historias y una conversación siempre cerca.'}
        </p>
      </header>
      {admin && (
        <>
          <div
            className="admin-stats"
            role="group"
            aria-label="Filtrar pedidos"
          >
            {(
              [
                ['requested', stats.requested],
                ['awaiting_payment', stats.awaiting_payment],
                ['active', stats.active],
                ['overdue', stats.overdue],
                ['unread', stats.unread],
              ] as const
            ).map(([key, value]) => (
              <button
                key={key}
                type="button"
                className={key === 'unread' ? 'admin-stat-unread' : undefined}
                aria-pressed={filter === key}
                onClick={() => {
                  if (tab !== 'orders' && !switchTab('orders')) return;
                  toggleFilter(key);
                }}
              >
                <strong>{value}</strong>
                <span>{filterLabel[key]}</span>
              </button>
            ))}
          </div>
          <nav className="shop-tabs" aria-label="Secciones del panel">
            <button
              aria-pressed={tab === 'orders'}
              onClick={() => switchTab('orders')}
            >
              Pedidos y plazos
            </button>
            <button
              aria-pressed={tab === 'products'}
              onClick={() => switchTab('products')}
            >
              Productos
            </button>
            <button
              aria-pressed={tab === 'home'}
              onClick={() => switchTab('home')}
            >
              Página inicial
            </button>
            <button
              aria-pressed={tab === 'guide'}
              onClick={() => switchTab('guide')}
            >
              Guía del atelier
            </button>
          </nav>
        </>
      )}
      {error && (
        <div className="shop-error" role="alert">
          {error}{' '}
          <button onClick={() => setRefresh((n) => n + 1)}>
            Volver a cargar pedidos
          </button>
        </div>
      )}
      {notice && (
        <p className="shop-notice" role="status">
          {notice}
        </p>
      )}
      {!admin && !loading && unreadTotal > 0 && (
        <p className="shop-notice unread-summary" role="status">
          El atelier te ha escrito: {unreadTotal}{' '}
          {unreadTotal === 1 ? 'mensaje nuevo' : 'mensajes nuevos'}.
        </p>
      )}
      {tab === 'guide' ? (
        <AdminGuide />
      ) : tab === 'home' ? (
        <AdminHome onDirty={setEditorDirty} />
      ) : tab === 'products' ? (
        <AdminProducts onDirty={setEditorDirty} />
      ) : (
        <>
          {admin && (
            <form
              className="admin-order-tools"
              onSubmit={(e) => {
                e.preventDefault();
                setPage(0);
                setSearch(
                  String(
                    new FormData(e.currentTarget).get('search') ?? '',
                  ).trim(),
                );
              }}
            >
              <label>
                Buscar pedido o cliente
                <input
                  name="search"
                  type="search"
                  maxLength={120}
                  placeholder="Número, nombre o correo electrónico"
                  defaultValue={search}
                />
              </label>
              <label>
                Estado
                <select
                  value={filter}
                  onChange={(e) => {
                    setFilter(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="all">Todos los pedidos</option>
                  {Object.entries(filterLabel).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Ordenar por
                <select
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="priority">Necesitan atención</option>
                  <option value="newest">Más recientes</option>
                  <option value="deadline">Fecha de entrega</option>
                </select>
              </label>
              <button className="button" type="submit" disabled={loading}>
                Buscar
              </button>
              <button
                type="button"
                onClick={() => setRefresh((n) => n + 1)}
                disabled={loading}
              >
                Actualizar
              </button>
              {search && (
                <p role="status">
                  Resultados para «{search}». Borra el texto y pulsa Buscar para
                  ver todos.
                </p>
              )}
            </form>
          )}
          {admin && filter !== 'all' && (
            <p className="admin-filter-note">
              Mostrando: {filterLabel[filter]}.{' '}
              <button
                type="button"
                className="shop-text-button"
                onClick={() => toggleFilter(filter)}
              >
                Ver todos los pedidos
              </button>
            </p>
          )}
          <div className="order-list">
            {loading ? (
              <p role="status">Cargando pedidos…</p>
            ) : orders.length === 0 ? (
              <div className="shop-empty">
                <h2>Aquí empiezan nuevas historias.</h2>
                <p>
                  {admin
                    ? filter === 'all'
                      ? 'Los pedidos aparecerán aquí cuando un cliente los cree.'
                      : 'Nada pendiente en este apartado.'
                    : 'Todavía no tienes pedidos.'}
                </p>
                <a href="/tienda" className="button">
                  Explorar la tienda ↗
                </a>
              </div>
            ) : (
              orders.map((o) => (
                <button
                  key={o.id}
                  className="order-row"
                  onClick={() => {
                    setSelected(o.id);
                    window.history.replaceState(
                      null,
                      '',
                      `${admin ? '/admin' : '/cuenta'}?order=${o.id}`,
                    );
                  }}
                >
                  <div>
                    <strong>
                      #{o.number} ·{' '}
                      {admin
                        ? o.customer_name
                        : o.kind === 'custom'
                          ? 'Tu encargo'
                          : 'Tu selección'}
                    </strong>
                    <small>{date(o.created_at)}</small>
                  </div>
                  <span className="order-badges">
                    <span className={`order-badge status-${o.status}`}>
                      {statusLabel[o.status]}
                    </span>
                    {(o.unread_count ?? 0) > 0 && (
                      <span className="order-badge unread-badge">
                        {o.unread_count === 1
                          ? '1 mensaje nuevo'
                          : `${o.unread_count} mensajes nuevos`}
                      </span>
                    )}
                  </span>
                  <div>
                    <small>Preparado para</small>
                    <span>{date(o.due_at)}</span>
                  </div>
                  <strong>
                    {o.total_cents === null
                      ? 'Por presupuestar'
                      : money(o.total_cents)}{' '}
                    ↗
                  </strong>
                </button>
              ))
            )}
          </div>
          {admin && (
            <div className="shop-pagination">
              <button
                disabled={loading || page === 0}
                onClick={() => setPage(page - 1)}
              >
                ← Anterior
              </button>
              <span>Página {page + 1}</span>
              <button
                disabled={loading || !hasMore}
                onClick={() => setPage(page + 1)}
              >
                Siguiente →
              </button>
            </div>
          )}
        </>
      )}
      {!admin && (
        <details className="password-settings">
          <summary>Cambiar mi contraseña</summary>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const f = new FormData(form);
              setSavingPassword(true);
              setNotice('');
              setError('');
              try {
                await api('/auth/password', 'POST', {
                  current: f.get('current'),
                  password: f.get('password'),
                });
                form.reset();
                setNotice('Contraseña actualizada.');
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setSavingPassword(false);
              }
            }}
          >
            <label>
              Contraseña actual
              <input
                name="current"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <label>
              Nueva contraseña
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
              />
            </label>
            <button className="button" disabled={savingPassword}>
              {savingPassword ? 'Guardando…' : 'Guardar contraseña'}
            </button>
          </form>
        </details>
      )}
      {!admin && <ContactSettings user={user} />}
      {!admin && notificationsEnabled && <NotificationSettings user={user} />}
      {!admin && <SessionSettings />}
    </>
  );
}
