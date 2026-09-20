export const site = {
  name: 'Qalbi Atelier',
  instagram: 'https://www.instagram.com/qalbiatelier/',
  whatsapp: '34667525416',
  description:
    'Bordado, ganchillo e ilustración en Málaga. Creaciones artesanales y piezas por encargo para regalar con intención.',
};

// Conversa por WhatsApp a partir de um pedido, para cliente e atelier.
export function whatsappUrl(phone: string, message: string) {
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
}
export function orderContactUrl(number: string) {
  return whatsappUrl(
    site.whatsapp,
    `Hola, te escribo por mi pedido #${number} de Qalbi.`,
  );
}
export function contactUrl(piece?: string) {
  const message = piece
    ? `Hola, me interesa «${piece}». Me gustaría saber si se puede personalizar.`
    : 'Hola, tengo una idea para una pieza especial. ¿La pensamos juntas?';
  return `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(message)}`;
}
