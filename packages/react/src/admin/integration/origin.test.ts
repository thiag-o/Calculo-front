import { describe, expect, it } from 'vitest';
import {
  ORIGIN_WITH_PATH_MESSAGE,
  ORIGIN_INVALID_HOST_MESSAGE,
  ORIGIN_WITHOUT_SCHEME_MESSAGE,
  EMPTY_ORIGIN_MESSAGE,
  originProblem,
} from './origin';

describe('originProblem', () => {
  it.each([
    'https://app.exemplo.com.br',
    'http://localhost:5274',
    'https://app.exemplo.com.br:8443',
    'HTTPS://App.Exemplo.com.br',
    'https://app.exemplo.com.br/',
    '  https://app.exemplo.com.br  ',
    'http://127.0.0.1:8080',
    'http://[::1]:5274',
  ])('aceita %s', (origin) => {
    expect(originProblem(origin)).toBeUndefined();
  });

  it.each([
    ['', EMPTY_ORIGIN_MESSAGE],
    ['   ', EMPTY_ORIGIN_MESSAGE],
    ['app.exemplo.com.br', ORIGIN_WITHOUT_SCHEME_MESSAGE],
    ['ftp://app.exemplo.com.br', ORIGIN_WITHOUT_SCHEME_MESSAGE],
    ['//app.exemplo.com.br', ORIGIN_WITHOUT_SCHEME_MESSAGE],
    ['https://app.exemplo.com.br/painel', ORIGIN_WITH_PATH_MESSAGE],
    ['https://app.exemplo.com.br//', ORIGIN_WITH_PATH_MESSAGE],
    ['https://app.exemplo.com.br?a=1', ORIGIN_WITH_PATH_MESSAGE],
    ['https://app.exemplo.com.br#topo', ORIGIN_WITH_PATH_MESSAGE],
    ['https://', ORIGIN_INVALID_HOST_MESSAGE],
    ['https://ana@app.exemplo.com.br', ORIGIN_INVALID_HOST_MESSAGE],
    ['https://app exemplo.com.br', ORIGIN_INVALID_HOST_MESSAGE],
    ['https://app.exemplo.com.br:', ORIGIN_INVALID_HOST_MESSAGE],
    ['https://app.exemplo.com.br:porta', ORIGIN_INVALID_HOST_MESSAGE],
    ['https://app.exemplo.com.br:70000', ORIGIN_INVALID_HOST_MESSAGE],
  ])('recusa "%s"', (origin, message) => {
    expect(originProblem(origin)).toBe(message);
  });
});
