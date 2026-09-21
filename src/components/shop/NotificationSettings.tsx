import { useState } from 'react';
import { api } from './api';
import type { User } from './types';
// Só aparece quando o backend tem provedor de email configurado.
export default function NotificationSettings({ user }: { user: User }) {
  const [enabled, setEnabled] = useState(user.email_notifications ?? true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <details className="password-settings">
      <summary>Avisos por correo electrónico</summary>
      <p>
        Te escribo a {user.email} cuando recibes un presupuesto o una respuesta
        del atelier, o cuando tu pedido avanza. Nunca incluyo el contenido de la
        conversación en el correo.
      </p>
      <label className="shop-checkbox">
        <input
          type="checkbox"
          checked={enabled}
          disabled={busy}
          onChange={async (e) => {
            const next = e.target.checked;
            setBusy(true);
            setError('');
            try {
              await api('/auth/notifications', 'PUT', { enabled: next });
              setEnabled(next);
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />{' '}
        Recibir avisos por correo electrónico
      </label>
      {error && (
        <p role="alert" className="shop-error">
          {error}
        </p>
      )}
    </details>
  );
}
