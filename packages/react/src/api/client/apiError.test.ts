import { describe, expect, it } from 'vitest';
import { ApiError, isCancellation } from './apiError';

describe('isCancellation', () => {
  it('reconhece uma requisição cancelada (AbortError)', () => {
    expect(isCancellation(new DOMException('Cancelado', 'AbortError'))).toBe(true);
  });

  it('não confunde outros erros com cancelamento', () => {
    expect(isCancellation(new Error('x'))).toBe(false);
    expect(isCancellation(new ApiError({ status: 500, code: 'internal_error', message: 'x' }))).toBe(false);
    expect(isCancellation(undefined)).toBe(false);
    expect(isCancellation('AbortError')).toBe(false);
  });
});
