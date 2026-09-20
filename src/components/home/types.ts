import type { GalleryPiece } from '../../content/types';
export interface HomePhoto {
  src: string;
  alt: string;
}
export interface HomeCard extends HomePhoto {
  id: string;
  title: string;
  category: string;
  description: string;
  visible: boolean;
}
export interface HomeContent {
  photos: Record<'hero' | 'story' | 'portrait', HomePhoto>;
  cards: HomeCard[];
}
export interface HomeDocument {
  revision: number;
  content: HomeContent;
}
export const galleryCards = (cards: HomeCard[]): GalleryPiece[] =>
  cards
    .filter((c) => c.visible)
    .map((c) => ({ ...c, srcSet: '', width: 1000, height: 1000 }));
