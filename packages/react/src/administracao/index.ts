// Vertical "administracao" (ADR 0003).
// Administração: usuários, papéis, chaves de API e domínios autorizados, e os parâmetros de segurança do tenant.
// Este arquivo é a interface pública da vertical; o resto da pasta é privado.

// A tela inteira, com as abas internas, e a permissão de cada área. O módulo usa a mesma tela no casca e no modo
// incorporado, com as abas ligadas às rotas, e as mesmas permissões no menu.
export { Administracao, PERMISSOES_ADMINISTRACAO } from './Administracao';
export type { AbaAdministracao, AdministracaoProps } from './Administracao';

// Cada área, avulsa (as sub-verticais).
export { Usuarios } from './usuarios';
export { Papeis } from './papeis';
export { ChavesApi, DominiosAutorizados, Integracao } from './integracao';
export { Seguranca } from './seguranca';
