import { useState } from 'react';
import { api } from './api';
interface Session {
  label: string;
  created_at: string;
  last_seen_at: string;
  current: boolean;
}
const when = (value: string) =>
  new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
// Quem entrou na conta e de onde; encerra as demais sem trocar a senha.
export default function SessionSettings() {
  const [sessions, setSessions] = useState<Session[]>([]),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(''),
    [error, setError] = useState('');
  async function load() {
    try {
      setSessions(
        (await api<{ sessions: Session[] }>('/auth/sessions')).sessions,
      );
    } catch (err) {
      setError((err as Error).message);
    }
  }
  return (
    <details
      className="password-settings"
      onToggle={(e) => e.currentTarget.open && void load()}
    >
      <summary>Dónde está abierta mi cuenta</summary>
      <ul className="session-list">
        {sessions.map((s, i) => (
          <li key={i}>
            <strong>{s.label || 'Dispositivo'}</strong>
            {s.current && ' · este dispositivo'}
            <br />
            <small>
              Desde {when(s.created_at)} · último uso {when(s.last_seen_at)}
            </small>
          </li>
        ))}
      </ul>
      {sessions.length > 1 && (
        <button
          className="button"
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError('');
            try {
              const result = await api<{ closed: number }>(
                '/auth/sessions/close-others',
                'POST',
              );
              setNotice(
                result.closed === 1
                  ? 'Se cerró 1 sesión.'
                  : `Se cerraron ${result.closed} sesiones.`,
              );
              await load();
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Cerrar las demás sesiones
        </button>
      )}
      <p role="status">{notice}</p>
      {error && (
        <p role="alert" className="shop-error">
          {error}
        </p>
      )}
    </details>
  );
}
