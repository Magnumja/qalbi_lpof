// Para adicionar uma criação: importe a foto e acrescente um objeto nesta lista.
// Passo a passo completo: comoadicionarfotos.md, na raiz do projeto.
import type { Piece } from './types';
import { validatePieces } from './validate-pieces';
import embroidery from '../assets/photos/embroidery.jpg';
import wedding from '../assets/photos/wedding.jpg';
import panda from '../assets/photos/panda.jpg';
import illustration from '../assets/photos/illustration.jpg';
import bear from '../assets/photos/bear.jpg';
import lorrayne from '../assets/photos/lorrayne.jpg';

// A ordem abaixo define a ordem dos cards. Cada id precisa ser único.
export const pieces = [
  {
    id: 'palabras',
    title: 'Palabras que se quedan',
    category: 'Bordado',
    image: embroidery,
    alt: 'Bastidor con frase bordada y pequeñas flores blancas',
    description:
      'Una frase, unas flores y un lugar donde guardar lo que importa. Un ejemplo de cómo las palabras pueden convertirse en un recuerdo bordado.',
  },
  {
    id: 'panda',
    title: 'Un abrazo de hilo',
    category: 'Ganchillo',
    image: panda,
    alt: 'Panda de ganchillo con falda verde y pequeñas flores',
    description:
      'Un pequeño personaje, hecho punto a punto. Sus colores y detalles son el comienzo de una conversación sobre tu próxima pieza.',
  },
  {
    id: 'ilustracion',
    title: 'Historias en papel',
    category: 'Ilustración',
    image: illustration,
    alt: 'Selección de ilustraciones y encargos personales de Qalbi',
    description:
      'Personas, lugares y pequeñas cosas que dicen mucho de ti. Una selección de encargos donde una idea personal encuentra su forma en la ilustración.',
  },
  {
    id: 'panuelos',
    title: 'Para un día inolvidable',
    category: 'Bordado',
    image: wedding,
    alt: 'Pañuelos claros bordados a mano con mensajes personales',
    description:
      'Palabras para acompañar un momento especial. Estos pañuelos muestran cómo un mensaje personal puede convertirse en un regalo lleno de significado.',
  },
  {
    id: 'osito',
    title: 'Compañeros de aventuras',
    category: 'Ganchillo',
    image: bear,
    alt: 'Lorrayne mostrando un osito de ganchillo con ropa azul y amarilla',
    description:
      'Personajes con detalles propios, creados con tiempo y cariño. Cuéntame qué personaje imaginas y exploramos sus posibilidades.',
  },
  {
    id: 'patitos',
    title: 'Pequeños, muy queridos',
    category: 'Ganchillo',
    image: lorrayne,
    alt: 'Lorrayne con dos patitos de ganchillo y detalles en malva',
    description:
      'Detalles de ganchillo que acompañan una ocasión especial. Un punto de partida para pensar en un regalo con algo de esa persona.',
  },
] as const satisfies readonly Piece[];

validatePieces(pieces);
