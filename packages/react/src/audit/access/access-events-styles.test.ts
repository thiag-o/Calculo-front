/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'access-events.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);

describe('CSS de Auditoria › Acessos', () => {
  it('espaços e larguras só pelos tokens --fc-*, sem px cru', () => {
    expect(css.match(/\d+(\.\d+)?px/g) ?? []).toEqual([]);
    expect(css).toContain('var(--fc-space-16)');
    expect(css).toContain('var(--fc-field-width-select)');
    expect(css).toContain('var(--fc-field-width-date)');
  });
});
