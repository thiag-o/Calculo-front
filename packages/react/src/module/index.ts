// Vertical "module" (ADR 0003).
// <FluxoCalculo>: module root, internal routes and navigation (sidebar in the app, tabs when embedded).
// <Home>, <Catalog>, <Admin> and <Audit>: each screen on its own, with the same internal provider (root, API and cache).
// This file is the vertical's public interface; the rest of the folder is private.
export { FluxoCalculo } from './FluxoCalculo';
export type { FluxoEvent, FluxoCalculoProps } from './FluxoCalculo';
export type { FluxoNavigation } from './router/ModuleRouter';
export type { FluxoScreen } from './screens';
export { Admin, Audit, Catalog, Home } from './standalone/StandaloneScreens';
export type { AdminProps, AuditProps, CatalogProps, HomeProps, StandaloneScreenProps } from './standalone/StandaloneScreens';
