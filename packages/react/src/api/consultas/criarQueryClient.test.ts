import { MutationObserver } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErroApi } from '../cliente/erroApi';
import { criarQueryClient } from './criarQueryClient';

function erro(status: number, codigo: string) {
  return new ErroApi({ status, codigo, mensagem: `Mensagem de ${codigo}.` });
}

describe('criarQueryClient', () => {
  const clientes: ReturnType<typeof criarQueryClient>[] = [];
  function novoCliente() {
    const cliente = criarQueryClient();
    clientes.push(cliente);
    return cliente;
  }

  afterEach(() => {
    for (const cliente of clientes.splice(0)) cliente.clear();
  });

  it.each([
    [401, 'sem_sessao'],
    [403, 'sem_permissao'],
    [422, 'dados_invalidos'],
  ])('não repete a consulta num erro %i (%s)', async (status, codigo) => {
    const consulta = vi.fn().mockRejectedValue(erro(status, codigo));

    await expect(novoCliente().fetchQuery({ queryKey: ['x', status], queryFn: consulta, retryDelay: 0 })).rejects.toMatchObject({ codigo });

    expect(consulta).toHaveBeenCalledTimes(1);
  });

  it('repete até 3 vezes numa falha passageira (5xx)', async () => {
    const consulta = vi.fn().mockRejectedValue(erro(503, 'resposta_inesperada'));

    await expect(novoCliente().fetchQuery({ queryKey: ['5xx'], queryFn: consulta, retryDelay: 0 })).rejects.toBeInstanceOf(ErroApi);

    expect(consulta).toHaveBeenCalledTimes(4);
  });

  it('repete numa falha de rede e devolve o dado quando ela passa', async () => {
    const consulta = vi.fn().mockRejectedValueOnce(erro(0, 'sem_conexao')).mockResolvedValue('ok');

    await expect(novoCliente().fetchQuery({ queryKey: ['rede'], queryFn: consulta, retryDelay: 0 })).resolves.toBe('ok');

    expect(consulta).toHaveBeenCalledTimes(2);
  });

  it('nunca repete uma mutação', async () => {
    const mutacao = vi.fn().mockRejectedValue(erro(503, 'resposta_inesperada'));
    const cliente = novoCliente();

    const observador = new MutationObserver(cliente, { mutationFn: mutacao, retryDelay: 0 });

    await expect(observador.mutate(undefined)).rejects.toBeInstanceOf(ErroApi);

    expect(mutacao).toHaveBeenCalledTimes(1);
  });
});
