import { Fragment, type ReactNode } from 'react';
import { useSessionGeneration } from '../session';

/**
 * Frame of a screen that takes the whole module, with no sidebar and no tabs (the workflow editor, E4-20). In the shell it is
 * the `main`; embedded it is the named region, because the host app page already has its own `main`. Like the layouts,
 * it starts the screen over when another session takes over (`generation`).
 */
export function FullScreen({ embedded, children }: { embedded: boolean; children: ReactNode }) {
  const generation = useSessionGeneration();
  const content = <Fragment key={generation}>{children}</Fragment>;
  return embedded ? (
    <section className="fc-embedded fc-module-full" aria-label="Fluxo de Cálculo">
      {content}
    </section>
  ) : (
    <main className="fc-module-content fc-module-full">{content}</main>
  );
}
