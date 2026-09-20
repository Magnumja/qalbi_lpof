import { useId, useState } from 'react';
import { api } from '../shop/api';
import type { HomePhoto } from './types';

async function preparePhoto(file: File): Promise<string> {
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
export default function PhotoField({
  value,
  onChange,
  onBusy,
  withAlt = true,
}: {
  value: HomePhoto;
  onChange: (photo: HomePhoto) => void;
  onBusy: (busy: boolean) => void;
  withAlt?: boolean;
}) {
  const id = useId();
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  return (
    <div className="home-photo-field">
      {value.src ? (
        <img
          className="home-photo-preview"
          src={value.src}
          alt={value.alt || 'Vista previa de la foto'}
        />
      ) : (
        <p className="home-photo-preview home-photo-empty">Sin foto todavía</p>
      )}
      <label>
        Subir foto desde tu dispositivo
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-describedby={id}
          disabled={uploading}
          onChange={async (e) => {
            const file = e.currentTarget.files?.[0];
            e.currentTarget.value = '';
            if (!file) return;
            setError('');
            setUploading(true);
            onBusy(true);
            try {
              const data = await preparePhoto(file);
              const result = await api<{ url: string }>(
                '/admin/media',
                'POST',
                { data },
              );
              onChange({ ...value, src: result.url });
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setUploading(false);
              onBusy(false);
            }
          }}
        />
      </label>
      <small id={id}>
        JPG, PNG o WebP, hasta 12 MB. La foto se optimiza automáticamente y se
        publica al guardar.
      </small>
      {uploading && <p role="status">Preparando y subiendo la foto…</p>}
      {error && (
        <p role="alert" className="shop-error">
          {error}
        </p>
      )}
      <label>
        O usar una dirección de imagen
        <input
          value={value.src}
          required
          maxLength={1000}
          onChange={(e) => onChange({ ...value, src: e.target.value })}
        />
      </label>
      {withAlt && (
        <label>
          Descripción de la foto (accesibilidad)
          <input
            value={value.alt}
            required
            minLength={3}
            maxLength={300}
            onChange={(e) => onChange({ ...value, alt: e.target.value })}
          />
        </label>
      )}
    </div>
  );
}
