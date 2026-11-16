import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dadosOuErro, ErroApi, useClienteApi, type Esquemas } from '../../api';

/** Os cinco parâmetros de sessão e senha do tenant, cada um com valor, padrão e limites (gerado do contrato). */
export type ConfiguracaoSeguranca = Esquemas['ConfiguracaoSeguranca'];
/** Um parâmetro: `valor` em vigor, `padrao` e os limites inclusivos `minimo` e `maximo` (gerado do contrato). */
export type ParametroSeguranca = Esquemas['ParametroSeguranca'];
/** Corpo da alteração: os cinco valores, nas unidades do nome (gerado do contrato). */
export type AlteracaoConfiguracaoSeguranca = Esquemas['AlteracaoConfiguracaoSeguranca'];

/**
 * Chave no cache, sob `administracao` (ADR 0020). Não leva o tenant: a troca de tenant reinicia o cache (ADR 0015).
 * Nenhuma outra aba da Administração mostra estes parâmetros, então salvar só atualiza esta chave.
 */
export const CHAVE_SEGURANCA = ['administracao', 'seguranca'] as const;

/** Os parâmetros de segurança do tenant atual (`GET /v1/configuracoes/seguranca`). */
export function useConfiguracaoSeguranca() {
  const cliente = useClienteApi();
  return useQuery({
    queryKey: CHAVE_SEGURANCA,
    queryFn: ({ signal }) => dadosOuErro(cliente.GET('/v1/configuracoes/seguranca', { signal })),
  });
}

/**
 * Substitui os cinco parâmetros (`PUT /v1/configuracoes/seguranca`). A resposta é o corpo do GET e vai direto
 * para o cache. Fora dos limites (`valor_fora_do_limite`), os limites são buscados de novo: os que a tela tinha
 * estavam desatualizados.
 */
export function useAlterarConfiguracaoSeguranca() {
  const cliente = useClienteApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (corpo: AlteracaoConfiguracaoSeguranca) => dadosOuErro(cliente.PUT('/v1/configuracoes/seguranca', { body: corpo })),
    onSuccess: (dados) => queryClient.setQueryData(CHAVE_SEGURANCA, dados),
    onError: (erro) => {
      if (erro instanceof ErroApi && erro.codigo === 'valor_fora_do_limite') {
        void queryClient.invalidateQueries({ queryKey: CHAVE_SEGURANCA });
      }
    },
  });
}
