import { useEffect, useState } from 'react';
import CreationGallery from '../CreationGallery';
import type { GalleryPiece } from '../../content/types';
import { loadHome } from './load-home';
import { galleryCards } from './types';
export default function PublishedGallery({
  fallback,
}: {
  fallback: GalleryPiece[];
}) {
  const [pieces, setPieces] = useState(fallback);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    loadHome()
      .then((home) => {
        if (active) {
          setPieces(galleryCards(home.content.cards));
          setRevision(home.revision);
        }
      })
      .catch(() => {
        /* A galeria original permanece disponível se a API cair. */
      });
    return () => {
      active = false;
    };
  }, []);
  return pieces.length ? (
    <CreationGallery key={revision} pieces={pieces} />
  ) : (
    <p>
      Pronto compartiremos nuevas creaciones. Mientras tanto,{' '}
      <a href="/encargo">cuéntanos tu idea</a>.
    </p>
  );
}
