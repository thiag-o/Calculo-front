import { useMutation, useQuery, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import { dadosOuErro, useClienteApi, type Esquemas } from '../../api';

/** O que a tela sabe do link antes da troca: a senha mínima e o prazo (gerado do contrato). */
export type LinkVerificado = Esquemas['LinkVerificado'];

/** Token do link e a nova senha (gerado do contrato). */
export type NovaSenha = Esquemas['NovaSenha'];

/**
 * Consulta o link de redefinição (`POST /v1/redefinicao/verificacao`, rota pública) sem consumi-lo. O token vai no
 * corpo, e não na URL, para não aparecer em log. Sem token, nada é consultado. Token inexistente, usado ou vencido:
 * `ErroApi` `link_invalido` (4xx, sem repetir).
 */
export function useVerificarLink(token: string): UseQueryResult<LinkVerificado> {
  const cliente = useClienteApi();
  return useQuery({
    queryKey: ['redefinicao', token],
    queryFn: ({ signal }) => dadosOuErro(cliente.POST('/v1/redefinicao/verificacao', { body: { token }, signal })),
    enabled: token !== '',
    // O link não muda sozinho; se vencer enquanto a pessoa digita, o envio responde `link_invalido`.
    staleTime: Infinity,
  });
}

/**
 * Troca a senha pelo link (`POST /v1/redefinicao`, rota pública, `204`). Não cria sessão: a pessoa entra depois.
 * Os erros chegam como `ErroApi` (decida pelo `codigo`: `link_invalido`, `senha_invalida`, `dados_invalidos`…).
 */
export function useRedefinirSenha(): UseMutationResult<void, Error, NovaSenha> {
  const cliente = useClienteApi();
  return useMutation({
    mutationFn: async (corpo: NovaSenha) => {
      await dadosOuErro(cliente.POST('/v1/redefinicao', { body: corpo }));
    },
  });
}
