import { useEffect, useRef, useState } from 'react';
import { contactUrl } from '../content/site';
import type { GalleryPiece } from '../content/pieces';
import '../styles/gallery.css';

export default function CreationGallery({
  pieces,
}: {
  pieces: GalleryPiece[];
}) {
  // Os filtros nascem do cadastro: uma técnica nova ganha seu botão automaticamente.
  const categories = [
    'Todas',
    ...new Set(pieces.map((piece) => piece.category)),
  ];
  const grid = useRef<HTMLDivElement>(null);
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
    if (selected && dialog.current) {
      dialog.current.showModal();
      // Cada peça começa no topo, mesmo após ler uma descrição longa.
      dialog.current.scrollTop = 0;
    }
  }, [selected]);

  // Revela cada card uma vez ao entrar na tela; trocar o filtro inicia uma nova sequência.
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motion.matches) return;

    const animations: Animation[] = [];
    const observer = new IntersectionObserver(
      (entries) => {
        entries
          .filter((entry) => entry.isIntersecting)
          .forEach((entry, index) => {
            if (!motion.matches) {
              animations.push(
                entry.target.animate(
                  [
                    { opacity: 0, transform: 'translateY(14px)' },
                    { opacity: 1, transform: 'translateY(0)' },
                  ],
                  {
                    duration: 480,
                    delay: index * 45,
                    easing: 'ease-out',
                    fill: 'backwards',
                  },
                ),
              );
            }
            observer.unobserve(entry.target);
          });
      },
      { threshold: 0.12 },
    );

    grid.current
      ?.querySelectorAll('.creation-card')
      .forEach((card) => observer.observe(card));
    const cancelMotion = () => {
      if (motion.matches) animations.forEach((animation) => animation.cancel());
    };
    motion.addEventListener('change', cancelMotion);
    return () => {
      observer.disconnect();
      animations.forEach((animation) => animation.cancel());
      motion.removeEventListener('change', cancelMotion);
    };
  }, [category]);

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
      <div className="creation-grid" ref={grid}>
        {filtered.map((piece) => (
          <article key={piece.id} className="creation-card">
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
              {/* O título cadastrado também preenche a mensagem do WhatsApp. */}
              <a
                href={contactUrl(piece.title)}
                target="_blank"
                rel="noreferrer"
                aria-label={`Consultar por WhatsApp: ${piece.title}`}
              >
                <span className="consult-label">WhatsApp</span>
                <span className="contact-arrow" aria-hidden="true">
                  ↗
                </span>
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
          <>
            <div className="dialog-controls">
              <button
                className="dialog-close"
                type="button"
                onClick={close}
                aria-label="Cerrar detalles"
              >
                ×
              </button>
            </div>
            <div className="piece-dialog-inner">
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
          </>
        )}
      </dialog>
    </>
  );
}
