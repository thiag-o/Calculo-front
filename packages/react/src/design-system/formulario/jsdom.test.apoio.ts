// Apoio aos testes (não é um teste nem vai para o pacote): recursos do navegador que o jsdom não tem
// e que o Radix usa no posicionamento (Popper) e no Select. Basta importar no topo do arquivo de teste.

if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

const prototipo = Element.prototype as Element & {
  hasPointerCapture?: (id: number) => boolean;
  setPointerCapture?: (id: number) => void;
  releasePointerCapture?: (id: number) => void;
  scrollIntoView?: () => void;
};
prototipo.hasPointerCapture ??= () => false;
prototipo.setPointerCapture ??= () => {};
prototipo.releasePointerCapture ??= () => {};
prototipo.scrollIntoView ??= () => {};

export {};
