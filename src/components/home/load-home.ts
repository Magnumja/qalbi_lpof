import type { HomeDocument } from './types';
// Uma consulta compartilhada pelas fotos principais e pela galeria em cada visita.
let request: Promise<HomeDocument> | undefined;
export function loadHome() {
  return (request ??= fetch('/api/home', {
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  }).then(async (response) => {
    if (!response.ok) throw new Error('Página inicial no disponible');
    return response.json() as Promise<HomeDocument>;
  }));
}
