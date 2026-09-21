// Reduz e reencoda a foto no navegador antes do envio (home, produtos e conversa).
export async function preparePhoto(file: File): Promise<string> {
  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    file.size > 12 * 1024 * 1024
  )
    throw new Error('Elige JPG, PNG o WebP de hasta 12 MB.');
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No se pudo preparar la foto.');
    context.fillStyle = '#f5f0e8';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.85, 0.7, 0.5]) {
      const base64 = canvas.toDataURL('image/jpeg', quality).split(',')[1];
      if (base64.length < 740000) return base64;
    }
    throw new Error('Prueba con una foto más pequeña.');
  } finally {
    bitmap.close();
  }
}
