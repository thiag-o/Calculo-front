import { useCallback, type KeyboardEvent } from 'react';
import { useDraftEditor } from './DraftEditor';

/** Input types without a text of their own: Ctrl Z on them is for the draft. */
const NON_TEXT_INPUTS = new Set(['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit']);

/**
 * Where the keys keep their own meaning: the text fields (each has its native undo), the formula editor (Monaco has its
 * own undo for the text) and the dialogs.
 */
const OWN_UNDO =
  'textarea, select, [contenteditable]:not([contenteditable="false"]), .monaco-editor, [role="dialog"], [role="alertdialog"]';

function keepsOwnUndo(target: Element): boolean {
  if (target.closest(OWN_UNDO)) return true;
  const input = target.closest('input');
  return input !== null && !NON_TEXT_INPUTS.has(input.type);
}

/**
 * Ctrl Z undoes, and Ctrl Shift Z or Ctrl Y redo (Cmd on the Mac), for keys pressed inside the editor: the handler goes
 * on the editor's own element, never on the window (ADR 0002). The keys stay with the element when it has an undo of its
 * own: text fields, the formula editor (each change it makes reaches the draft as a step) and dialogs. Keys from portals
 * (which bubble up the React tree but sit outside the editor element) are left alone too.
 */
export function useUndoShortcuts(): (event: KeyboardEvent<HTMLElement>) => void {
  const { undo, redo, readOnly } = useDraftEditor();
  return useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (readOnly || event.defaultPrevented || event.altKey) return;
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      const isRedoY = key === 'y' && !event.shiftKey;
      if (key !== 'z' && !isRedoY) return;
      const target = event.target;
      if (!(target instanceof Element) || !event.currentTarget.contains(target) || keepsOwnUndo(target)) return;
      event.preventDefault();
      if (event.shiftKey || isRedoY) redo();
      else undo();
    },
    [readOnly, redo, undo],
  );
}
