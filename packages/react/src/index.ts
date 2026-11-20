// Public interface of the @fluxo/react package (design.md §3 "Front incorporável").
// Always re-exports from each vertical's index.ts; no internal paths.
export { FluxoCalculo } from './module';
export type { FluxoEvent, FluxoCalculoProps, FluxoNavigation, FluxoScreen } from './module';
// Per-screen components, each working on its own (own root, API and cache; in-memory navigation).
export { Admin, Audit, Catalog, Home, Workflows } from './module';
export type { AdminProps, AuditProps, CatalogProps, HomeProps, StandaloneScreenProps, WorkflowsProps } from './module';
export { SignIn, ResetPassword } from './session';
export type { SignInProps, ResetPasswordProps, Session } from './session';
export type { FluxoTheme } from './design-system';
