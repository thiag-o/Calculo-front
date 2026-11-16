// Interface pública do pacote @fluxo/react (design.md §3 "Front incorporável").
// Reexporta sempre do index.ts de cada vertical; nada de caminho interno.
export { FluxoCalculo } from './modulo';
export type { EventoFluxo, FluxoCalculoProps, NavegacaoFluxo, TelaFluxo } from './modulo';
// Componentes por tela, cada um funcionando sozinho (raiz, API e cache próprios; navegação em memória).
export { Administracao, Auditoria, Inicio } from './modulo';
export type { AdministracaoProps, AuditoriaProps, InicioProps, TelaAvulsaProps } from './modulo';
export { Entrar, RedefinirSenha } from './sessao';
export type { EntrarProps, RedefinirSenhaProps, Sessao } from './sessao';
export type { TemaFluxo } from './design-system';
