import type { Piece } from './types';

/** Interrompe o build com uma mensagem útil quando o cadastro está inválido. */
export function validatePieces(pieces: readonly Piece[]): void {
  const ids = new Set<string>();
  for (const [index, piece] of pieces.entries()) {
    const context = `Peça ${index + 1} (${piece.id})`;
    for (const field of [
      'id',
      'title',
      'category',
      'alt',
      'description',
    ] as const) {
      if (!piece[field].trim())
        throw new Error(`${context}: preencha ${field}.`);
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(piece.id)) {
      throw new Error(
        `${context}: use um id em minúsculas, sem espaços ou acentos.`,
      );
    }
    if (ids.has(piece.id)) throw new Error(`${context}: id duplicado.`);
    ids.add(piece.id);
    if (
      piece.category !== piece.category.trim() ||
      piece.category.toLowerCase() === 'todas'
    ) {
      throw new Error(
        `${context}: categoria não pode ter espaços nas pontas nem ser Todas.`,
      );
    }
  }
}
