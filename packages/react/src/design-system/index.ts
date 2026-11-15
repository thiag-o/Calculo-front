// Vertical "design-system" (ADR 0003).
// Tokens --fc-* (claro/escuro), tipografia e componentes base. Vertical compartilhada: não depende de nenhuma outra.
// Este arquivo é a interface pública da vertical; o resto da pasta é privado.
export { RaizFluxo, usePortalFluxo } from './raiz';
export type { RaizFluxoProps, TemaFluxo } from './raiz';
export { Texto, classesTexto, estilosTexto } from './tipografia';
export type { EstiloTexto, OpcoesTexto, TextoProps, TomTexto } from './tipografia';
