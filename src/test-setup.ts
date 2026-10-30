import '@testing-library/jest-dom/vitest';

// jsdom não implementa captura de ponteiro; a gaveta (vaul) a usa ao tocar no conteúdo.
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.hasPointerCapture = () => false;
}
