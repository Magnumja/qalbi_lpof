import { useEffect, useState } from 'react';
import { api, money } from './api';
import type { Product } from './types';
import PhotoField from '../home/PhotoField';
import '../../styles/home-editor.css';
export default function AdminProducts({
  onDirty,
}: {
  onDirty: (dirty: boolean) => void;
}) {
  const [dirty, setDirty] = useState(false);
  const [search, setSearch] = useState('');
  const [visibility, setVisibility] = useState('all');
  const [category, setCategory] = useState('');
  const [availability, setAvailability] = useState('all');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [listError, setListError] = useState('');
  const [loading, setLoading] = useState(true);
  function markDirty(value: boolean) {
    setDirty(value);
    onDirty(value);
  }
  function canLeave() {
    return (
      !dirty ||
      window.confirm('¿Descartar los cambios de esta pieza sin guardar?')
    );
  }
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const [products, setProducts] = useState<Product[]>([]),
    [editing, setEditing] = useState<Product | null>(null),
    [formKey, setFormKey] = useState(0),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [image, setImage] = useState(''),
    [notice, setNotice] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true);
    setListError('');
    // Um pequeno atraso evita uma consulta por tecla; resultados antigos são ignorados.
    const timer = window.setTimeout(() => {
      api<{
        products: Product[];
        categories: string[];
        total: number;
        has_more: boolean;
      }>(
        `/admin/products?${new URLSearchParams({ search, category, visibility, availability, page: String(page) })}`,
      )
        .then((data) => {
          if (!active) return;
          setProducts(data.products);
          setCategories(data.categories);
          setTotal(data.total);
          setHasMore(data.has_more);
        })
        .catch((err) => {
          if (active) setListError(err.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [search, category, visibility, availability, page, refresh]);
  return (
    <section>
      <div className="shop-toolbar">
        <h2>Las piezas de la tienda</h2>
        <button
          className="shop-text-button"
          disabled={busy || uploading}
          onClick={() => {
            if (!canLeave()) return;
            markDirty(false);
            setEditing(null);
            setImage('');
            setFormKey(formKey + 1);
          }}
        >
          ＋ Nueva pieza
        </button>
      </div>
      <p>
        Publica solo piezas con precio, disponibilidad y plazo confirmados. Las
        existencias indican las unidades disponibles, sin contar las reservadas.
      </p>
      <div className="admin-order-tools">
        <label>
          Buscar una pieza
          <input
            type="search"
            value={search}
            maxLength={120}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Nombre o categoría"
          />
        </label>
        <label>
          Visibilidad
          <select
            value={visibility}
            onChange={(e) => {
              setVisibility(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">Todas las piezas</option>
            <option value="published">Publicadas</option>
            <option value="draft">Borradores</option>
          </select>
        </label>
        <label>
          Categoría
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Todas las categorías</option>
            {categories.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          Disponibilidad
          <select
            value={availability}
            onChange={(e) => {
              setAvailability(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">Todas</option>
            <option value="ready">Listas para enviar</option>
            <option value="made_to_order">Bajo pedido</option>
            <option value="out">Sin existencias</option>
          </select>
        </label>
        <button
          type="button"
          disabled={loading}
          onClick={() => setRefresh((n) => n + 1)}
        >
          Actualizar catálogo
        </button>
        <p role="status">
          {loading
            ? 'Cargando piezas…'
            : `${total} ${total === 1 ? 'pieza encontrada' : 'piezas encontradas'} · Página ${page + 1}`}
        </p>
      </div>
      {listError && (
        <p className="shop-error" role="alert">
          {listError} Usa Actualizar catálogo para volver a intentarlo.
        </p>
      )}
      <div className="admin-product-layout">
        <div className="admin-product-list">
          {!loading && !listError && !products.length && (
            <p>
              No hay piezas con estos filtros. Puedes buscar otro nombre o crear
              una nueva pieza.
            </p>
          )}
          {(!loading && !listError ? products : []).map((p) => (
            <button
              key={p.id}
              disabled={busy || uploading}
              aria-pressed={editing?.id === p.id}
              onClick={() => {
                if (!canLeave()) return;
                markDirty(false);
                setEditing(p);
                setImage(p.image_url);
                setFormKey(formKey + 1);
              }}
            >
              <img src={p.image_url} alt="" width={64} height={64} />
              <span>
                {p.title}
                <small>
                  {money(p.price_cents)} · {p.active ? 'Publicado' : 'Borrador'}{' '}
                  ·{' '}
                  {p.kind === 'made_to_order'
                    ? 'Bajo pedido'
                    : `${p.stock} ${p.stock === 1 ? 'disponible' : 'disponibles'}`}
                </small>
              </span>
              <span>↗</span>
            </button>
          ))}
          <div className="shop-pagination">
            <button
              type="button"
              disabled={loading || page === 0}
              onClick={() => setPage((n) => n - 1)}
            >
              ← Anterior
            </button>
            <button
              type="button"
              disabled={loading || !hasMore}
              onClick={() => setPage((n) => n + 1)}
            >
              Siguiente →
            </button>
          </div>
        </div>
        <form
          key={formKey}
          className="admin-form"
          onChange={() => markDirty(true)}
          onSubmit={async (e) => {
            e.preventDefault();
            setError('');
            setNotice('');
            if (!image) {
              setError('Sube una foto de la pieza antes de guardar.');
              return;
            }
            setBusy(true);
            const f = new FormData(e.currentTarget);
            const body = {
              title: f.get('title'),
              description: f.get('description'),
              category: f.get('category'),
              image_url: image,
              price_cents: Math.round(Number(f.get('price')) * 100),
              kind: f.get('kind'),
              stock: Number(f.get('stock')),
              lead_days: Number(f.get('days')),
              active: f.get('active') === 'on',
              ...(editing?.id ? { expected_stock: editing.stock } : {}),
            };
            try {
              const saved = await api<{ product: Product }>(
                editing?.id
                  ? `/admin/products/${editing.id}`
                  : '/admin/products',
                editing?.id ? 'PUT' : 'POST',
                body,
              );
              setEditing(saved.product);
              setRefresh((n) => n + 1);
              markDirty(false);
              setNotice('Pieza guardada.');
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset className="home-editor-fields" disabled={busy || uploading}>
            <h2>{editing?.id ? 'Editar pieza' : 'Una nueva creación'}</h2>
            {editing?.id && (
              <button
                type="button"
                className="shop-text-button"
                onClick={() => {
                  if (!canLeave()) return;
                  setEditing({
                    ...editing,
                    id: '',
                    title: `${editing.title.slice(0, 140)} (copia)`,
                    active: false,
                    stock: 0,
                  });
                  setImage(editing.image_url);
                  setFormKey((n) => n + 1);
                  markDirty(true);
                  setNotice(
                    'Copia sin publicar. Revisa el nombre, el precio y las existencias antes de guardar.',
                  );
                }}
              >
                Duplicar como borrador
              </button>
            )}
            <p className="shop-muted">
              Desmarca Publicar en la tienda para retirar una pieza sin perder
              su historial.
            </p>
            <label>
              Nombre
              <input
                name="title"
                required
                minLength={2}
                maxLength={150}
                defaultValue={editing?.title}
              />
            </label>
            <label>
              Descripción
              <textarea
                name="description"
                required
                minLength={10}
                maxLength={4000}
                rows={4}
                defaultValue={editing?.description}
              />
            </label>
            <label>
              Técnica o categoría
              <input
                name="category"
                list="catalog-categories"
                required
                minLength={2}
                maxLength={60}
                defaultValue={editing?.category ?? 'Bordado'}
              />
            </label>
            <datalist id="catalog-categories">
              {categories.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
            <fieldset className="shop-fieldset">
              <legend>Foto de la pieza</legend>
              <PhotoField
                key={formKey}
                value={{ src: image, alt: editing?.title ?? '' }}
                withAlt={false}
                onBusy={setUploading}
                onChange={(photo) => {
                  setImage(photo.src);
                  markDirty(true);
                }}
              />
            </fieldset>
            <div className="shop-form-row">
              <label>
                Precio en €
                <input
                  name="price"
                  type="number"
                  min={1}
                  max={10000}
                  step="0.01"
                  required
                  defaultValue={editing ? editing.price_cents / 100 : undefined}
                />
              </label>
              <label>
                Preparación (días)
                <input
                  name="days"
                  type="number"
                  min={1}
                  max={365}
                  required
                  defaultValue={editing?.lead_days ?? 7}
                />
              </label>
            </div>
            <label>
              Tipo
              <select
                name="kind"
                defaultValue={editing?.kind ?? 'made_to_order'}
              >
                <option value="made_to_order">Hecha por encargo</option>
                <option value="ready">Lista para enviar</option>
              </select>
            </label>
            <label>
              Unidades disponibles
              <input
                name="stock"
                type="number"
                min={0}
                max={10000}
                required
                defaultValue={editing?.stock ?? 0}
              />
              <small>
                Solo limita la compra de las piezas listas para enviar.
              </small>
            </label>
            <label className="shop-checkbox">
              <input
                type="checkbox"
                name="active"
                defaultChecked={editing?.active ?? false}
              />{' '}
              Publicar en la tienda
            </label>
            {error && (
              <p role="alert" className="shop-error">
                {error}
              </p>
            )}
            <p role="status">{notice}</p>
            <button className="button" disabled={busy || uploading}>
              {busy ? 'Guardando…' : 'Guardar pieza'}
            </button>
          </fieldset>
        </form>
      </div>
    </section>
  );
}
