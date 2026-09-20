import { useState } from 'react';
import { api } from './api';
import { whatsappUrl } from '../../content/site';
// O atelier gera um link único quando o cliente perde a senha.
export default function AccessLinkPanel({
  orderId,
  phone,
}: {
  orderId: string;
  phone?: string | null;
}) {
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false),
    [copied, setCopied] = useState(false),
    [error, setError] = useState('');
  return (
    <details className="order-history">
      <summary>El cliente no puede entrar</summary>
      <p>
        Genera un enlace de un solo uso, válido 24 horas, y envíaselo por el
        canal donde ya habláis. Con él elegirá una nueva contraseña.
      </p>
      {link ? (
        <>
          <label>
            Enlace de acceso
            <input readOnly value={link} onFocus={(e) => e.target.select()} />
          </label>
          <div className="shop-actions">
            <button
              className="button"
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  setCopied(true);
                } catch {
                  setError('Copia el enlace manualmente desde el campo.');
                }
              }}
            >
              {copied ? 'Copiado' : 'Copiar enlace'}
            </button>
            {phone && (
              <a
                className="button"
                href={whatsappUrl(
                  phone,
                  `Hola, aquí tienes tu enlace para volver a entrar en Qalbi (válido 24 horas): ${link}`,
                )}
                target="_blank"
                rel="noreferrer"
              >
                Enviar por WhatsApp ↗
              </a>
            )}
          </div>
        </>
      ) : (
        <button
          className="button"
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError('');
            try {
              const result = await api<{ url: string }>(
                `/admin/orders/${orderId}/access-link`,
                'POST',
              );
              setLink(result.url);
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Generando…' : 'Generar enlace de acceso'}
        </button>
      )}
      {error && (
        <p role="alert" className="shop-error">
          {error}
        </p>
      )}
    </details>
  );
}
