import { describe, expect, it } from 'vitest';
import {
  MENSAGEM_ORIGEM_COM_CAMINHO,
  MENSAGEM_ORIGEM_HOST_INVALIDO,
  MENSAGEM_ORIGEM_SEM_ESQUEMA,
  MENSAGEM_ORIGEM_VAZIA,
  problemaDaOrigem,
} from './origem';

describe('problemaDaOrigem', () => {
  it.each([
    'https://app.exemplo.com.br',
    'http://localhost:5274',
    'https://app.exemplo.com.br:8443',
    'HTTPS://App.Exemplo.com.br',
    'https://app.exemplo.com.br/',
    '  https://app.exemplo.com.br  ',
    'http://127.0.0.1:8080',
    'http://[::1]:5274',
  ])('aceita %s', (origem) => {
    expect(problemaDaOrigem(origem)).toBeUndefined();
  });

  it.each([
    ['', MENSAGEM_ORIGEM_VAZIA],
    ['   ', MENSAGEM_ORIGEM_VAZIA],
    ['app.exemplo.com.br', MENSAGEM_ORIGEM_SEM_ESQUEMA],
    ['ftp://app.exemplo.com.br', MENSAGEM_ORIGEM_SEM_ESQUEMA],
    ['//app.exemplo.com.br', MENSAGEM_ORIGEM_SEM_ESQUEMA],
    ['https://app.exemplo.com.br/painel', MENSAGEM_ORIGEM_COM_CAMINHO],
    ['https://app.exemplo.com.br//', MENSAGEM_ORIGEM_COM_CAMINHO],
    ['https://app.exemplo.com.br?a=1', MENSAGEM_ORIGEM_COM_CAMINHO],
    ['https://app.exemplo.com.br#topo', MENSAGEM_ORIGEM_COM_CAMINHO],
    ['https://', MENSAGEM_ORIGEM_HOST_INVALIDO],
    ['https://ana@app.exemplo.com.br', MENSAGEM_ORIGEM_HOST_INVALIDO],
    ['https://app exemplo.com.br', MENSAGEM_ORIGEM_HOST_INVALIDO],
    ['https://app.exemplo.com.br:', MENSAGEM_ORIGEM_HOST_INVALIDO],
    ['https://app.exemplo.com.br:porta', MENSAGEM_ORIGEM_HOST_INVALIDO],
    ['https://app.exemplo.com.br:70000', MENSAGEM_ORIGEM_HOST_INVALIDO],
  ])('recusa "%s"', (origem, mensagem) => {
    expect(problemaDaOrigem(origem)).toBe(mensagem);
  });
});
