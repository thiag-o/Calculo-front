import { cleanup, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeMonaco, renderWithProviders } from './formula.test-support';

// The real loader, with the Monaco modules simulated: each factory runs only when its module is imported for the first time,
// so the counters say exactly when the loader asked for Monaco and its worker.
const requested = vi.hoisted(() => ({ editor: 0, worker: 0 }));
const fake = vi.hoisted(() => ({ current: null as ReturnType<typeof createFakeMonaco> | null }));

vi.mock('monaco-editor/editor/editor.api', () => {
  requested.editor++;
  fake.current = createFakeMonaco();
  return fake.current.raw;
});

vi.mock('monaco-editor/editor/editor.worker?worker', () => {
  requested.worker++;
  return { default: class FakeWorker {} };
});

afterEach(() => {
  cleanup();
  delete (globalThis as { MonacoEnvironment?: unknown }).MonacoEnvironment;
});

describe('carregador do Monaco', () => {
  it('importar o pacote não pede o Monaco; o import() só roda quando o campo aparece', async () => {
    const { FormulaEditor } = await import('.');
    await import('./loadMonaco');
    expect(requested).toEqual({ editor: 0, worker: 0 });

    renderWithProviders(<FormulaEditor value="" onChange={() => {}} context="calculation" aria-label="Fórmula" />);
    await waitFor(() => expect(requested).toEqual({ editor: 1, worker: 1 }));
    await waitFor(() => expect(fake.current!.state.editors).toHaveLength(1));
  });

  it('o worker do editor é o arquivo local do pacote, sem CDN', async () => {
    vi.resetModules();
    const { loadMonaco } = await import('./loadMonaco');
    await loadMonaco();
    const environment = (globalThis as { MonacoEnvironment?: { getWorker: () => object } }).MonacoEnvironment;
    expect(environment?.getWorker().constructor.name).toBe('FakeWorker');
  });

  it('não troca o MonacoEnvironment de um hospedeiro que também usa o Monaco', async () => {
    const host = { getWorker: () => 'worker do hospedeiro' };
    (globalThis as { MonacoEnvironment?: unknown }).MonacoEnvironment = host;
    vi.resetModules();
    const { loadMonaco } = await import('./loadMonaco');
    await loadMonaco();
    expect((globalThis as { MonacoEnvironment?: unknown }).MonacoEnvironment).toBe(host);
  });
});
