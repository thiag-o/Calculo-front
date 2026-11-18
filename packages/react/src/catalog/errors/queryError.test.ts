import { describe, expect, it } from 'vitest';
import { ApiError } from '../../api';
import { isNotFoundError, queryErrorMessage } from './queryError';

const MESSAGES = { notFound: 'Não encontrado.', noPermission: 'Sem permissão.' };

function apiError(code: string): ApiError {
  return new ApiError({ status: 400, code, message: `Mensagem da API para ${code}` });
}

describe('queryErrorMessage', () => {
  it('not_found vira "não encontrado", em lista ou em detalhe', () => {
    expect(queryErrorMessage(apiError('not_found'), MESSAGES)).toBe('Não encontrado.');
    expect(queryErrorMessage(apiError('not_found'), { ...MESSAGES, byId: true })).toBe('Não encontrado.');
  });

  it('invalid_data vira "não encontrado" só na consulta por id', () => {
    expect(queryErrorMessage(apiError('invalid_data'), { ...MESSAGES, byId: true })).toBe('Não encontrado.');
  });

  it('invalid_data numa lista mostra a mensagem do erro', () => {
    expect(queryErrorMessage(apiError('invalid_data'), MESSAGES)).toBe('Mensagem da API para invalid_data');
  });

  it('no_permission usa o texto da tela, quando há um', () => {
    expect(queryErrorMessage(apiError('no_permission'), MESSAGES)).toBe('Sem permissão.');
  });

  it('no_permission sem texto da tela mostra a mensagem da API', () => {
    expect(queryErrorMessage(apiError('no_permission'), { notFound: 'x' })).toBe('Mensagem da API para no_permission');
  });

  it.each(['no_connection', 'unexpected_response', 'connection_failed'])('%s mostra a mensagem da API', (code) => {
    expect(queryErrorMessage(apiError(code), MESSAGES)).toBe(`Mensagem da API para ${code}`);
  });

  it('um erro que não é da API vira o texto genérico', () => {
    expect(queryErrorMessage(new Error('boom'), MESSAGES)).toBe('Não foi possível concluir agora. Tente de novo em instantes.');
  });
});

describe('isNotFoundError', () => {
  it.each([
    ['not_found', false, true],
    ['not_found', true, true],
    ['invalid_data', false, false],
    ['invalid_data', true, true],
    ['no_permission', true, false],
    ['no_connection', true, false],
  ])('%s (por id: %s) -> %s', (code, byId, expected) => {
    expect(isNotFoundError(apiError(code), byId)).toBe(expected);
  });

  it('não confunde um erro qualquer com "não encontrado"', () => {
    expect(isNotFoundError(new Error('x'), true)).toBe(false);
    expect(isNotFoundError(undefined)).toBe(false);
  });
});
