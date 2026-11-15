// Vertical "api" (ADR 0003).
// Cliente HTTP, tipos gerados do OpenAPI do backend e configuração do TanStack Query. Vertical compartilhada: não depende de nenhuma outra.
// Este arquivo é a interface pública da vertical; o resto da pasta é privado.

// Tipos gerados do contrato (ADR 0005). Nunca escritos à mão.
export type { components, operations, paths } from './gerado/esquema';
import type { components } from './gerado/esquema';
/** Os esquemas do contrato (ex.: `Esquemas['Sessao']`). */
export type Esquemas = components['schemas'];

// Cliente HTTP.
export { criarClienteApi } from './cliente/criarClienteApi';
export type { ClienteApi, ModoAutenticacao, OpcoesClienteApi } from './cliente/criarClienteApi';
export { CODIGO_RESPOSTA_INESPERADA, CODIGO_SEM_CONEXAO, ErroApi, dadosOuErro } from './cliente/erroApi';
export type { CorpoProblema } from './cliente/erroApi';
export { ProvedorApi, useClienteApi } from './cliente/ProvedorApi';
export type { PropsProvedorApi } from './cliente/ProvedorApi';

// TanStack Query.
export { criarQueryClient } from './consultas/criarQueryClient';
