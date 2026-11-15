import { useLayoutEffect, useState, type RefObject } from 'react';

/** Abaixo desta largura, o menu lateral fica só com ícones (estilos.md §15). */
export const LARGURA_MENU_COMPLETO = 1180;

/**
 * O módulo está mais estreito que 1180px? Mede a largura do próprio módulo, não a da janela: dentro de um
 * hospedeiro, quem decide a largura é ele (ADR 0002, estilos.md §15). Largura 0 (ainda sem layout) não conta.
 */
export function useLarguraEstreita(ref: RefObject<HTMLElement | null>): boolean {
  const [estreito, setEstreito] = useState(false);

  useLayoutEffect(() => {
    const elemento = ref.current;
    if (!elemento) return undefined;
    const medir = (largura: number) => setEstreito(largura > 0 && largura < LARGURA_MENU_COMPLETO);
    medir(elemento.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observador = new ResizeObserver((entradas) => {
      const ultima = entradas[entradas.length - 1];
      if (ultima) medir(ultima.contentRect.width);
    });
    observador.observe(elemento);
    return () => observador.disconnect();
  }, [ref]);

  return estreito;
}
