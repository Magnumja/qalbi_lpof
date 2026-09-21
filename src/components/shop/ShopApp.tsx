import { useEffect, useState } from 'react';
import { api, ApiError } from './api';
import type { ShopData, User } from './types';
import Store from './Store';
import AuthForm from './AuthForm';
import Account from './Account';
import AccessLinkForm from './AccessLinkForm';
import '../../styles/shop.css';
export default function ShopApp({
  mode,
}: {
  mode: 'store' | 'custom' | 'account';
}) {
  const [user, setUser] = useState<User | null>(null),
    [shop, setShop] = useState<ShopData | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [accessToken, setAccessToken] = useState('');
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('acceso');
    if (token && /^[a-f0-9]{64}$/.test(token)) {
      setAccessToken(token);
      // O token sai do histórico do navegador; fica só na memória da página.
      window.history.replaceState(null, '', '/cuenta');
    }
    let active = true;
    Promise.all([
      api<{ user: User }>('/auth/me')
        .then((d) => d.user)
        .catch((err) => {
          if (err instanceof ApiError && err.status === 401) return null;
          throw err;
        }),
      api<ShopData>('/shop'),
    ])
      .then(([u, s]) => {
        if (active) {
          setUser(u);
          setShop(s);
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
  }, []);
  return (
    <main className="shop-shell wrap" id="contenido">
      <nav className="shop-nav" aria-label="Tienda">
        <a href="/tienda" aria-current={mode === 'store' ? 'page' : undefined}>
          La tienda
        </a>
        <a
          href="/encargo"
          aria-current={mode === 'custom' ? 'page' : undefined}
        >
          Un encargo especial
        </a>
        <a
          href="/cuenta"
          aria-current={mode === 'account' ? 'page' : undefined}
        >
          Mis pedidos
        </a>
        {user?.role === 'admin' && <a href="/admin">Administrar</a>}
        {user && (
          <button
            onClick={async () => {
              try {
                await api('/auth/logout', 'POST');
                window.location.assign('/cuenta');
              } catch (err) {
                setError((err as Error).message);
              }
            }}
          >
            Salir
          </button>
        )}
      </nav>
      {loading ? (
        <p className="shop-loading" role="status">
          Preparando tu espacio…
        </p>
      ) : error ? (
        <div className="shop-empty">
          <h1>Vuelvo enseguida.</h1>
          <p role="alert">{error}</p>
          <button className="button" onClick={() => window.location.reload()}>
            Volver a intentar
          </button>
        </div>
      ) : shop && (mode === 'store' || mode === 'custom') ? (
        <Store
          shop={shop}
          user={user}
          onLogin={setUser}
          custom={mode === 'custom'}
        />
      ) : user ? (
        <Account
          user={user}
          paymentEnabled={shop?.payment_enabled ?? false}
          notificationsEnabled={shop?.notifications_enabled ?? false}
        />
      ) : accessToken ? (
        <AccessLinkForm token={accessToken} onLogin={setUser} />
      ) : (
        <AuthForm onLogin={setUser} />
      )}
    </main>
  );
}
