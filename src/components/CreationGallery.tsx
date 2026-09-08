import { useEffect, useRef, useState } from 'react';
import { contactUrl } from '../content/site';
import type { GalleryPiece } from '../content/pieces';
import '../styles/gallery.css';

const categories = ['Todas', 'Bordado', 'Ganchillo', 'Ilustración'];

export default function CreationGallery({
  pieces,
}: {
  pieces: GalleryPiece[];
}) {
  const [category, setCategory] = useState('Todas');
  const [selected, setSelected] = useState<GalleryPiece | null>(null);
  const [ready, setReady] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const filtered =
    category === 'Todas'
      ? pieces
      : pieces.filter((piece) => piece.category === category);

  useEffect(() => setReady(true), []);
  useEffect(() => {
    if (selected) dialog.current?.showModal();
  }, [selected]);

  function close() {
    dialog.current?.close();
    setSelected(null);
    opener.current?.focus();
  }

  return (
    <>
      <div className="gallery-toolbar">
        <div
          className="gallery-filters"
          role="group"
          aria-label="Filtrar creaciones por técnica"
        >
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              disabled={!ready}
              aria-pressed={category === item}
              onClick={() => setCategory(item)}
            >
              {item}
              {category === item && <span aria-hidden="true"> ↗</span>}
            </button>
          ))}
        </div>
        <p className="gallery-caption">
          Una selección del atelier <span aria-hidden="true">↙</span>
        </p>
      </div>
      <p className="sr-only" aria-live="polite">
        {filtered.length} creaciones
        {category !== 'Todas' ? ` de ${category.toLowerCase()}` : ''}
      </p>
      <div className="creation-grid">
        {filtered.map((piece, index) => (
          <article
            key={piece.id}
            className={`creation-card shape-${index % 3}`}
          >
            <button
              className="piece-image"
              type="button"
              disabled={!ready}
              aria-label={`Ver detalles de ${piece.title}`}
              onClick={(event) => {
                opener.current = event.currentTarget;
                setSelected(piece);
              }}
            >
              <img
                src={piece.src}
                srcSet={piece.srcSet}
                sizes="(max-width: 700px) 45vw, 30vw"
                width={piece.width}
                height={piece.height}
                alt={piece.alt}
                loading="lazy"
                decoding="async"
              />
              <span className="piece-tag">{piece.category}</span>
              <span className="view-piece">
                Ver la pieza <span aria-hidden="true">↗</span>
              </span>
            </button>
            <div className="piece-info">
              <div>
                <h3>{piece.title}</h3>
                <p>Creación por encargo</p>
              </div>
              <a
                href={contactUrl(piece.title)}
                target="_blank"
                rel="noreferrer"
                aria-label={`Consultar por WhatsApp: ${piece.title}`}
              >
                <span aria-hidden="true">↗</span>
              </a>
            </div>
          </article>
        ))}
      </div>
      <p className="gallery-footnote">
        Cada pieza cuenta una historia. Estas son algunas de las que ya han
        pasado por mis manos.
      </p>
      <dialog
        ref={dialog}
        className="piece-dialog"
        aria-labelledby="piece-title"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        {selected && (
          <div className="piece-dialog-inner">
            <button
              className="dialog-close"
              type="button"
              onClick={close}
              aria-label="Cerrar detalles"
            >
              ×
            </button>
            <img
              className="dialog-photo"
              src={selected.src}
              width={selected.width}
              height={selected.height}
              alt={selected.alt}
            />
            <div className="dialog-copy">
              <p className="eyebrow">{selected.category} · Qalbi Atelier</p>
              <h2 id="piece-title">{selected.title}</h2>
              <p>{selected.description}</p>
              <p className="dialog-note">
                Una creación anterior para inspirar la tuya. Consulta las
                posibilidades, el presupuesto y el plazo.
              </p>
              <a
                className="button"
                href={contactUrl(selected.title)}
                target="_blank"
                rel="noreferrer"
              >
                Quiero una pieza así <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
