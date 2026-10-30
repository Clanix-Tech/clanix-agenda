import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';

// `findBy*`/`waitFor` esperavam só 1 s: com a máquina ocupada a 1ª renderização passava disso.
configure({ asyncUtilTimeout: 4000 });

// jsdom não implementa captura de ponteiro; a gaveta (vaul) a usa ao tocar no conteúdo.
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.hasPointerCapture = () => false;
}
