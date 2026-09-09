import type { ImageMetadata } from 'astro';

/** Cadastro editado pela responsável pelo conteúdo. */
export interface Piece {
  id: string;
  title: string;
  category: string;
  alt: string;
  description: string;
  image: ImageMetadata;
}

/** Dados serializáveis enviados ao React, depois da otimização no Astro. */
export interface GalleryPiece extends Omit<Piece, 'image'> {
  src: string;
  srcSet: string;
  width: number;
  height: number;
}
