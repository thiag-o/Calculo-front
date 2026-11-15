// Interface pública do pacote @fluxo/react (design.md §3 "Front incorporável").
// Reexporta sempre do index.ts de cada vertical; nada de caminho interno.
export { FluxoCalculo } from './modulo';
export type { EventoFluxo, FluxoCalculoProps, NavegacaoFluxo, TelaFluxo } from './modulo';
export { Inicio } from './inicio';
export { Entrar } from './sessao';
export type { EntrarProps, Sessao } from './sessao';
export type { TemaFluxo } from './design-system';
