// Monaco loader (ADR 0037, E4-21): the only place that reaches `monaco-editor`, always through `import()`, so the package
// entry never contains it and the browser downloads the `monaco` chunk only when a formula field mounts.
// Only the editor core (`editor/editor.api`): no TypeScript, JSON or CSS language services; the `fluxo-formula` language is ours.
import type * as MonacoApi from 'monaco-editor/editor/editor.api';

export type Monaco = typeof MonacoApi;

interface MonacoEnvironmentHolder {
  MonacoEnvironment?: { getWorker?: (workerId: string, label: string) => Worker; [key: string]: unknown };
}

let loading: Promise<Monaco> | null = null;

/**
 * Loads Monaco once per page. The editor worker is the local file emitted by the build (no CDN). A host that already set its own
 * `MonacoEnvironment` (it uses Monaco too) keeps it. A failed load is not cached: the next field that mounts tries again.
 */
export function loadMonaco(): Promise<Monaco> {
  loading ??= Promise.all([import('monaco-editor/editor/editor.api'), import('monaco-editor/editor/editor.worker?worker')]).then(
    ([monaco, worker]) => {
      const holder = globalThis as MonacoEnvironmentHolder;
      const EditorWorker = worker.default;
      holder.MonacoEnvironment ??= { getWorker: () => new EditorWorker() };
      return monaco;
    },
    (error: unknown) => {
      loading = null;
      throw error;
    },
  );
  return loading;
}
