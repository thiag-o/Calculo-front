import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DecisionTableGrid } from './DecisionTableGrid';
import { TABLE_ID, manyRules, renderWithDraft, table, type Rendered } from './decision-table.test-support';
import { MAX_RULES, type DecisionTableNode } from './tableModel';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/*
 * Time limits of the test. Measured alone on this machine (jsdom, React in development mode): about 0.9 s to open 500
 * rules, about 28 ms per key with 500 rules and about 15 ms with 3; without the memoized rows, about 130 ms per key.
 * - Opening: up to 5 s, room for a busy machine (F43: the suite runs on 4 workers, sometimes with the e2e alongside).
 * - Typing: what the user feels is the time per key. The median with 500 rules must stay under 250 ms (well past what
 *   any machine needs here), and, since a busy machine slows both runs alike, under 4 times the median with 3 rules.
 *   A grid drawn again whole on each key gives about 8 times and fails.
 */
const OPEN_LIMIT_MS = 5000;
const KEY_LIMIT_MS = 250;
const KEY_RATIO_LIMIT = 4;
const TYPED = 'ENTRE 10 E 20';

function median(values: readonly number[]): number {
  return [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
}

/** Opens the grid with `node`, types `TYPED` in the first cell and gives the time of each key. */
async function typeInFirstCell(node: DecisionTableNode): Promise<{ rendered: Rendered; opened: number; keys: number[] }> {
  const started = performance.now();
  const rendered = renderWithDraft(<DecisionTableGrid nodeId={TABLE_ID} onClose={() => {}} />, { node });
  expect(screen.getAllByRole('rowheader')).toHaveLength(node.rules.length);
  const opened = performance.now() - started;
  const first = within(screen.getByRole('grid')).getAllByRole('gridcell')[0]!;
  await waitFor(() => expect(first).toHaveFocus());

  const keys: number[] = [];
  for (const key of TYPED) {
    const before = performance.now();
    await rendered.user.keyboard(key);
    keys.push(performance.now() - before);
  }
  expect(rendered.probe.table().rules[0]!.when[0]).toBe(TYPED);
  expect(screen.getByRole('textbox', { name: 'Regra 1, Condição 1: categoria' })).toHaveValue(TYPED);
  return { rendered, opened, keys };
}

describe('DecisionTableGrid com 500 regras', () => {
  it('abre e responde à digitação sem atraso perceptível', async () => {
    const small = await typeInFirstCell(table());
    small.rendered.unmount();
    cleanup();

    const big = await typeInFirstCell(table({ rules: manyRules(MAX_RULES, { when: 2, then: 2 }) }));
    expect(big.opened).toBeLessThan(OPEN_LIMIT_MS);
    expect(median(big.keys)).toBeLessThan(KEY_LIMIT_MS);
    expect(median(big.keys)).toBeLessThan(KEY_RATIO_LIMIT * Math.max(median(small.keys), 5));

    // Going to the last rule and typing there too.
    const before = performance.now();
    await big.rendered.user.keyboard('{Enter}{Control>}{End}{/Control}9');
    expect(performance.now() - before).toBeLessThan(KEY_LIMIT_MS * 3);
    expect(big.rendered.probe.table().rules[MAX_RULES - 1]!.then[1]).toBe('9');
  });
});
