import { act, cleanup, screen, waitFor } from '@testing-library/react';
import { memo, type ComponentProps, type NamedExoticComponent } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkflowCanvas } from './WorkflowCanvas';
import { blockOf, renderWithDraft } from './canvas.test-support';

// Each draw of a block, by its id. The block component is the real one, under the same `memo`: what is counted is what
// React Flow and the canvas make the block draw again.
const draws: string[] = [];

vi.mock('./nodes', async (importOriginal) => {
  const original = await importOriginal<typeof import('./nodes')>();
  type BlockProps = ComponentProps<typeof original.BlockNode>;
  const draw = (original.BlockNode as unknown as { type: (props: BlockProps) => ReturnType<typeof original.BlockNode> }).type;
  const CountedBlock = memo(function CountedBlock(props: BlockProps) {
    draws.push(props.id);
    return draw(props);
  }) as NamedExoticComponent<BlockProps>;
  return { ...original, BlockNode: CountedBlock, NODE_TYPES: { ...original.NODE_TYPES, block: CountedBlock } };
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function drawsOf(id: string): number {
  return draws.filter((drawn) => drawn === id).length;
}

describe('WorkflowCanvas: só o que mudou é desenhado de novo', () => {
  it('mover um bloco pelo teclado não desenha de novo os outros blocos', async () => {
    const { user, probe } = renderWithDraft(<WorkflowCanvas />);
    const pontos = await screen.findByRole('group', { name: /^Pontos/ });
    // Selecting first: the selection changes the look of the block (and so draws it); the move is what is measured.
    pontos.focus();
    await user.keyboard(' ');
    expect(probe.selection.item).toEqual({ type: 'node', id: 'calc_pontos' });
    const others = { table: drawsOf('td_elegibilidade'), total: drawsOf('calc_total'), moved: drawsOf('calc_pontos') };

    await user.keyboard('{ArrowRight}{ArrowDown}');
    expect(blockOf(probe.definition, 'calc_pontos')!.position).toEqual({ x: 248, y: 8 });
    expect(drawsOf('calc_pontos')).toBeGreaterThan(others.moved);
    expect(drawsOf('td_elegibilidade')).toBe(others.table);
    expect(drawsOf('calc_total')).toBe(others.total);

    // The analysis of the move comes back with new (equal) symbols and dependencies: still no draw of the others.
    const analyses = () => vi.mocked(fetch).mock.calls.filter(([request]) => (request as Request).url.endsWith('/draft/analysis')).length;
    await waitFor(() => expect(analyses()).toBeGreaterThan(0), { timeout: 3000 });
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(drawsOf('td_elegibilidade')).toBe(others.table);
    expect(drawsOf('calc_total')).toBe(others.total);
  });
});
