import { useEffect, useState } from 'react';
import { api, ApiError } from '../shop/api';
import AuthForm from '../shop/AuthForm';
import Account from '../shop/Account';
import type { User } from '../shop/types';
import '../../styles/shop.css';

export default function AdminApp({
  loginPage = false,
}: {
  loginPage?: boolean;
}) {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    api<{ user: User }>('/auth/admin/me')
      .then(({ user }) => {
        if (!active) return;
        if (loginPage) window.location.replace('/admin');
        else setUser(user);
      })
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiError && [401, 403].includes(err.status)) {
          if (!loginPage) window.location.replace('/admin/login');
        } else setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loginPage]);
  return (
    <main className="shop-shell admin-workspace" id="contenido">
      {user && (
        <div className="admin-session">
          <span>{user.name} · Administración</span>
          <button
            className="shop-text-button"
            onClick={async () => {
              try {
                await api('/auth/logout', 'POST');
                window.location.assign('/admin/login');
              } catch (err) {
                setError((err as Error).message);
              }
            }}
          >
            Cerrar sesión
          </button>
        </div>
      )}
      {error && (
        <div className="shop-error" role="alert">
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>
            Volver a intentar
          </button>
        </div>
      )}
      {loading ? (
        <p role="status">Preparando el panel…</p>
      ) : user ? (
        <Account user={user} admin />
      ) : loginPage && !error ? (
        <AuthForm admin onLogin={() => window.location.replace('/admin')} />
      ) : null}
    </main>
  );
}
