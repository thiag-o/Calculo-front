import { forwardRef } from 'react';
import { problemCountText, useProblemCounts } from './problemGroups';
import './problems.css';

export interface ProblemCounterProps {
  /** Opens the Problems tab of the bottom panel. */
  onOpen: () => void;
}

/**
 * The bar's "● N problemas" (estilos.md §14 and §16; E4-20): red dot and the count, clickable, opening the Problems tab.
 * Without problems, nothing is shown.
 */
export const ProblemCounter = forwardRef<HTMLButtonElement, ProblemCounterProps>(function ProblemCounter({ onOpen }, ref) {
  const { total } = useProblemCounts();
  if (total === 0) return null;
  return (
    <button ref={ref} type="button" className="fc-problem-counter" onClick={onOpen}>
      <span className="fc-problem-counter-dot" aria-hidden="true" />
      {problemCountText(total)}
    </button>
  );
});
