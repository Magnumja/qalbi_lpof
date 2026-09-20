import { useState } from 'react';
import { api } from './api';
import type { User } from './types';
export default function ContactSettings({ user }: { user: User }) {
  const [phone, setPhone] = useState(user.phone ?? ''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(''),
    [error, setError] = useState('');
  return (
    <details className="password-settings">
      <summary>Mi teléfono de acceso</summary>
      <form
        className="admin-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          setBusy(true);
          setError('');
          setNotice('');
          try {
            const result = await api<{ phone: string | null }>(
              '/auth/contact',
              'PUT',
              {
                phone: phone.trim() || null,
                password: new FormData(form).get('password'),
              },
            );
            setPhone(result.phone ?? '');
            form.reset();
            setNotice(
              'Contacto actualizado. Puedes entrar con tu email o teléfono y contraseña.',
            );
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>
          Tu email de acceso: {user.email}. El teléfono es opcional; déjalo
          vacío para retirarlo.
        </p>
        <label>
          Teléfono con prefijo de país
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={40}
            autoComplete="tel"
            placeholder="+34 600 123 456"
          />
        </label>
        <label>
          Confirma tu contraseña
          <input
            type="password"
            name="password"
            required
            minLength={12}
            maxLength={128}
            autoComplete="current-password"
          />
        </label>
        {error && (
          <p role="alert" className="shop-error">
            {error}
          </p>
        )}
        <p role="status">{notice}</p>
        <button className="button" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar teléfono'}
        </button>
      </form>
    </details>
  );
}
