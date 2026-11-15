import { QueryClient } from '@tanstack/react-query';
import { ErroApi } from '../cliente/erroApi';

/** Quantas vezes uma consulta é repetida depois da primeira falha, quando vale repetir. */
const MAXIMO_DE_REPETICOES = 3;

/**
 * Repete a consulta só quando a falha pode ser passageira (rede, 5xx).
 * Erro 4xx é resposta definitiva da API (sem sessão, sem permissão, dados inválidos...): repetir não muda nada.
 */
export function deveRepetirConsulta(falhas: number, erro: unknown): boolean {
  if (erro instanceof ErroApi && erro.status >= 400 && erro.status < 500) return false;
  return falhas < MAXIMO_DE_REPETICOES;
}

/**
 * O `QueryClient` com os padrões do produto:
 * - consultas: repetidas até 3 vezes só em falha passageira (rede, 5xx), nunca em 4xx;
 * - mutações: nunca repetidas (não são idempotentes).
 * O restante segue os padrões do TanStack Query.
 */
export function criarQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: deveRepetirConsulta },
      mutations: { retry: false },
    },
  });
}
