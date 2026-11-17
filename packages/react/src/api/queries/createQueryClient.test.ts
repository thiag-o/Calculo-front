import { MutationObserver } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../client/apiError';
import { createQueryClient } from './createQueryClient';

function error(status: number, code: string) {
  return new ApiError({ status, code, message: `Mensagem de ${code}.` });
}

describe('createQueryClient', () => {
  const clients: ReturnType<typeof createQueryClient>[] = [];
  function newClient() {
    const client = createQueryClient();
    clients.push(client);
    return client;
  }

  afterEach(() => {
    for (const client of clients.splice(0)) client.clear();
  });

  it.each([
    [401, 'sem_sessao'],
    [403, 'sem_permissao'],
    [422, 'dados_invalidos'],
  ])('não repete a consulta num erro %i (%s)', async (status, code) => {
    const query = vi.fn().mockRejectedValue(error(status, code));

    await expect(newClient().fetchQuery({ queryKey: ['x', status], queryFn: query, retryDelay: 0 })).rejects.toMatchObject({ code });

    expect(query).toHaveBeenCalledTimes(1);
  });

  it('repete até 3 vezes numa falha passageira (5xx)', async () => {
    const query = vi.fn().mockRejectedValue(error(503, 'resposta_inesperada'));

    await expect(newClient().fetchQuery({ queryKey: ['5xx'], queryFn: query, retryDelay: 0 })).rejects.toBeInstanceOf(ApiError);

    expect(query).toHaveBeenCalledTimes(4);
  });

  it('repete numa falha de rede e devolve o dado quando ela passa', async () => {
    const query = vi.fn().mockRejectedValueOnce(error(0, 'sem_conexao')).mockResolvedValue('ok');

    await expect(newClient().fetchQuery({ queryKey: ['network'], queryFn: query, retryDelay: 0 })).resolves.toBe('ok');

    expect(query).toHaveBeenCalledTimes(2);
  });

  it('nunca repete uma mutação', async () => {
    const mutation = vi.fn().mockRejectedValue(error(503, 'resposta_inesperada'));
    const client = newClient();

    const observer = new MutationObserver(client, { mutationFn: mutation, retryDelay: 0 });

    await expect(observer.mutate(undefined)).rejects.toBeInstanceOf(ApiError);

    expect(mutation).toHaveBeenCalledTimes(1);
  });
});
