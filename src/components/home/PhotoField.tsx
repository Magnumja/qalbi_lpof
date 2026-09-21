import { useId, useState } from 'react';
import { api } from '../shop/api';
import { preparePhoto } from '../shop/photo';
import type { HomePhoto } from './types';

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
      {!value.src && (
        <p className="shop-error" role="status">
          Sube una foto para poder guardar.
        </p>
      )}
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
