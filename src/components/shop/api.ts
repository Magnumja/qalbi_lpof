export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
export async function api<T>(
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Qalbi-Request': '1' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw new ApiError(
      'No pudimos conectar. Comprueba tu conexión y vuelve a intentarlo. Si estabas creando un pedido, revisa Mis pedidos antes de repetirlo.',
      0,
    );
  }
  const data = await response.json().catch(() => {
    throw new ApiError(
      'El servicio no respondió correctamente. Vuelve a intentarlo en unos momentos.',
      response.status,
    );
  });
  if (!response.ok) {
    const requestId = response.headers.get('x-request-id');
    throw new ApiError(
      (data.error ?? 'No se pudo completar la operación.') +
        (response.status >= 500 && requestId ? ` (código ${requestId})` : ''),
      response.status,
    );
  }
  return data;
}
export const money = (cents: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(
    cents / 100,
  );
export const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(
        new Date(value.length === 10 ? `${value}T12:00:00` : value),
      )
    : 'Por confirmar';
export const statusLabel: Record<string, string> = {
  requested: 'Por presupuestar',
  awaiting_payment: 'Pendiente de pago',
  confirmed: 'Confirmado',
  in_progress: 'En creación',
  ready: 'Listo',
  shipped: 'Enviado',
  completed: 'Entregado',
  cancelled: 'Cancelado',
  unpaid: 'Sin pagar',
  pending: 'Pendiente',
  paid: 'Pagado',
  refunded: 'Reembolsado',
};
