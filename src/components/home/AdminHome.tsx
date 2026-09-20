import { useEffect, useState } from 'react';
import { api } from '../shop/api';
import CreationGallery from '../CreationGallery';
import PhotoField from './PhotoField';
import { galleryCards } from './types';
import type { HomeCard, HomeDocument } from './types';
import '../../styles/home-editor.css';

const slots = {
  hero: 'Foto de apertura',
  story: 'Historia destacada',
  portrait: 'Retrato del atelier',
} as const;
export default function AdminHome({
  onDirty,
}: {
  onDirty: (dirty: boolean) => void;
}) {
  const [home, setHome] = useState<HomeDocument | null>(null);
  const [selected, setSelected] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState(false);
  async function load() {
    setError('');
    try {
      const data = await api<HomeDocument>('/admin/home');
      setHome(data);
      setSelected(data.content.cards[0]?.id ?? 'hero');
      setDirty(false);
      onDirty(false);
    } catch (err) {
      setError((err as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function change(next: HomeDocument) {
    setHome(next);
    setDirty(true);
    onDirty(true);
    setNotice('');
    setPreview(false);
  }
  if (!home)
    return (
      <section>
        <p role={error ? 'alert' : 'status'}>
          {error || 'Cargando la página inicial…'}
        </p>
        {error && (
          <button className="button" onClick={() => void load()}>
            Volver a intentar
          </button>
        )}
      </section>
    );
  const cards = home.content.cards;
  const card = cards.find((c) => c.id === selected);
  const slot = selected in slots ? (selected as keyof typeof slots) : null;
  function updateCard(patch: Partial<HomeCard>) {
    if (home)
      change({
        ...home,
        content: {
          ...home.content,
          cards: home.content.cards.map((c) =>
            c.id === selected ? { ...c, ...patch } : c,
          ),
        },
      });
  }
  function move(offset: number) {
    const index = cards.findIndex((c) => c.id === selected);
    const next = [...cards];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    change({ ...home!, content: { ...home!.content, cards: next } });
  }
  return (
    <section className="home-editor">
      <div className="shop-toolbar">
        <div>
          <h2>Página inicial</h2>
          <p>Fotos y creaciones destacadas, con tu propia voz.</p>
        </div>
        <a
          className="shop-text-button"
          href="/"
          target="_blank"
          rel="noreferrer"
        >
          Ver página publicada ↗
        </a>
      </div>
      <p>
        Los cambios se guardan juntos al publicar. Los botones de consulta se
        actualizan automáticamente con el nombre de cada creación.
      </p>
      {error && (
        <p className="shop-error" role="alert">
          {error}
        </p>
      )}
      <p role="status">
        {notice ||
          (dirty
            ? 'Tienes cambios sin publicar.'
            : 'Estás viendo la versión publicada.')}
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            const saved = await api<HomeDocument>('/admin/home', 'PUT', home);
            setHome(saved);
            setDirty(false);
            onDirty(false);
            setNotice(
              'Página publicada. Los cambios aparecerán al abrir o actualizar el inicio.',
            );
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy} className="home-editor-fields">
          <div className="home-editor-layout">
            <nav
              className="home-editor-list"
              aria-label="Contenido de la página inicial"
            >
              <h3>Fotos principales</h3>
              {Object.entries(slots).map(([key, label]) => (
                <button
                  type="button"
                  key={key}
                  aria-pressed={selected === key}
                  onClick={() => setSelected(key)}
                >
                  {label}
                </button>
              ))}
              <h3>Cards destacados</h3>
              {cards.map((c, i) => (
                <button
                  type="button"
                  key={c.id}
                  aria-pressed={selected === c.id}
                  onClick={() => setSelected(c.id)}
                >
                  <img src={c.src} alt="" width={48} height={48} />
                  <span>
                    {i + 1}. {c.title || 'Nueva creación'}
                    <small>{c.visible ? 'Visible' : 'Oculto'}</small>
                  </span>
                </button>
              ))}
              <button
                type="button"
                disabled={cards.length >= 30}
                onClick={() => {
                  const id = crypto.randomUUID();
                  change({
                    ...home,
                    content: {
                      ...home.content,
                      cards: [
                        ...cards,
                        {
                          id,
                          title: 'Nueva creación',
                          category: 'Bordado',
                          description:
                            'Describe aquí la historia y los detalles de esta creación.',
                          src: '/shop/embroidery.jpg',
                          alt: 'Describe la fotografía de tu creación',
                          visible: false,
                        },
                      ],
                    },
                  });
                  setSelected(id);
                }}
              >
                ＋ Añadir card
              </button>
            </nav>
            <div className="admin-form">
              {card && (
                <>
                  <h3>Editar creación</h3>
                  <label>
                    Nombre del card
                    <input
                      value={card.title}
                      required
                      minLength={2}
                      maxLength={150}
                      onChange={(e) => updateCard({ title: e.target.value })}
                    />
                  </label>
                  <label>
                    Técnica o categoría
                    <input
                      value={card.category}
                      required
                      minLength={2}
                      maxLength={60}
                      onChange={(e) => updateCard({ category: e.target.value })}
                    />
                  </label>
                  <label>
                    Historia y detalles
                    <textarea
                      rows={5}
                      value={card.description}
                      required
                      minLength={10}
                      maxLength={4000}
                      onChange={(e) =>
                        updateCard({ description: e.target.value })
                      }
                    />
                  </label>
                  <PhotoField
                    key={card.id}
                    value={card}
                    onChange={(photo) => updateCard(photo)}
                    onBusy={setBusy}
                  />
                  <label className="home-visibility">
                    <input
                      type="checkbox"
                      checked={card.visible}
                      onChange={(e) =>
                        updateCard({ visible: e.target.checked })
                      }
                    />{' '}
                    Mostrar en la página inicial
                  </label>
                  <div className="home-editor-actions">
                    <button
                      type="button"
                      disabled={cards[0].id === card.id}
                      onClick={() => move(-1)}
                    >
                      ↑ Subir
                    </button>
                    <button
                      type="button"
                      disabled={cards.at(-1)?.id === card.id}
                      onClick={() => move(1)}
                    >
                      ↓ Bajar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            `¿Eliminar «${card.title}»? Solo se aplicará al publicar.`,
                          )
                        ) {
                          change({
                            ...home,
                            content: {
                              ...home.content,
                              cards: cards.filter((c) => c.id !== card.id),
                            },
                          });
                          setSelected('hero');
                        }
                      }}
                    >
                      Eliminar card
                    </button>
                  </div>
                </>
              )}
              {slot && (
                <>
                  <h3>{slots[slot]}</h3>
                  <PhotoField
                    key={slot}
                    value={home.content.photos[slot]}
                    onChange={(photo) =>
                      change({
                        ...home,
                        content: {
                          ...home.content,
                          photos: { ...home.content.photos, [slot]: photo },
                        },
                      })
                    }
                    onBusy={setBusy}
                  />
                </>
              )}
            </div>
          </div>
          <div className="home-publish-bar">
            <button className="button" disabled={!dirty || busy}>
              {busy ? 'Guardando…' : 'Publicar cambios'}
            </button>
            <button type="button" onClick={() => setPreview(!preview)}>
              {preview ? 'Cerrar vista previa' : 'Vista previa de los cards'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (
                  !dirty ||
                  window.confirm('¿Descartar los cambios sin publicar?')
                )
                  void load();
              }}
            >
              Recargar / descartar
            </button>
          </div>
        </fieldset>
      </form>
      {preview && (
        <section className="home-gallery-preview">
          <h3>Vista previa · todavía sin publicar</h3>
          <CreationGallery
            key={JSON.stringify(cards)}
            pieces={galleryCards(cards)}
          />
        </section>
      )}
    </section>
  );
}
