// The text of a `role="status"` region that is read again when the same text is announced twice in a row.
import { useCallback, useState } from 'react';

// A screen reader reads a live region only when its content changes: the same text twice changes nothing. The second
// one carries a no-break space at the end, so the node changes and it is read again.
const NO_BREAK_SPACE = '\u00a0';

/** The text to put in the status region and `announce`, which also works with a text equal to the previous one. */
export function useAnnouncement(): [text: string, announce: (text: string) => void] {
  const [state, setState] = useState({ text: '', repeated: false });
  const announce = useCallback((text: string) => {
    setState((current) => ({ text, repeated: current.text === text && !current.repeated }));
  }, []);
  return [state.repeated ? state.text + NO_BREAK_SPACE : state.text, announce];
}
