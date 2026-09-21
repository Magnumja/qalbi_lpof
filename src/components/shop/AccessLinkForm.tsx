import { useState } from 'react';
import { api } from './api';
import type { User } from './types';
import { site, whatsappUrl } from '../../content/site';
// Aberto por /cuenta?acceso=TOKEN, enviado pelo atelier ao cliente.
export default function AccessLinkForm({
  token,
  onLogin,
}: {
  token: string;
  onLogin: (user: User) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <section className="shop-auth">
      <p className="eyebrow">Recuperar el acceso</p>
      <h1>Elige una nueva contraseña.</h1>
      <p>
        El atelier te envió este enlace para volver a entrar. Solo se usa una
        vez y caduca en 2 horas.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            const result = await api<{ user: User }>(
              '/auth/access-link',
              'POST',
              {
                token,
                password: new FormData(e.currentTarget).get('password'),
              },
            );
            onLogin(result.user);
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Nueva contraseña
          <input
            type="password"
            name="password"
            required
            minLength={12}
            maxLength={128}
            autoComplete="new-password"
          />
          <small>Mínimo 12 caracteres.</small>
        </label>
        {error && (
          <p role="alert" className="shop-error">
            {error}
          </p>
        )}
        <button className="button" disabled={busy}>
          {busy ? 'Un momento…' : 'Guardar y entrar'}
        </button>
      </form>
      <p className="shop-muted">
        Si el enlace caducó,{' '}
        <a
          href={whatsappUrl(
            site.whatsapp,
            'Hola, mi enlace de acceso a Qalbi caducó. ¿Me envías otro?',
          )}
          target="_blank"
          rel="noreferrer"
        >
          pide otro al atelier por WhatsApp
        </a>
        .
      </p>
    </section>
  );
}
