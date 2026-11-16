// Vertical "modulo" (ADR 0003).
// <FluxoCalculo>: raiz do módulo, rotas internas e navegação (menu lateral no app, abas quando incorporado).
// <Inicio>, <Administracao> e <Auditoria>: cada tela sozinha, com o mesmo provedor interno (raiz, API e cache).
// Este arquivo é a interface pública da vertical; o resto da pasta é privado.
export { FluxoCalculo } from './FluxoCalculo';
export type { EventoFluxo, FluxoCalculoProps } from './FluxoCalculo';
export type { NavegacaoFluxo } from './roteador/Roteador';
export type { TelaFluxo } from './telas';
export { Administracao, Auditoria, Inicio } from './avulso/TelasAvulsas';
export type { AdministracaoProps, AuditoriaProps, InicioProps, TelaAvulsaProps } from './avulso/TelasAvulsas';
