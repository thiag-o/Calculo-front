// Vertical "sessao" (ADR 0003).
// Login do app casca, token de incorporação e permissões do usuário atual.
// Este arquivo é a interface pública da vertical; o resto da pasta é privado.

// Sessão atual e permissões.
export { temPermissao, useSessao } from './useSessao';
export type { ResultadoSessao, Sessao } from './useSessao';

// Login, logout e troca de tenant.
export { useEntrar, useSair, useTrocarTenant } from './mutacoes';
export type { Credenciais } from './mutacoes';

// Tela de login do app casca.
export { Entrar } from './entrar/Entrar';
export type { EntrarProps } from './entrar/Entrar';
