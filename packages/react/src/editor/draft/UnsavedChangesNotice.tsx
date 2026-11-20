import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { Button, Notice } from '../../design-system';
import { useSession } from '../../session';
import { WORKFLOWS_EDIT_PERMISSION } from '../../workflows';
import { NO_PERMISSION_MESSAGE, saveErrorMessage } from './messages';
import { draftOwner, dropUnsavedChange, useUnsavedDraftChanges, type UnsavedDraftChange } from './unsavedChanges';
import './unsaved-changes.css';

export interface UnsavedChangesNoticeProps {
  /** "Voltar ao editor": opens the editor of that workflow, which starts from the change and saves it again. */
  onReturn: (workflowId: string) => void;
  /** Only the change of this workflow (e.g. on its Overview). Without it, the changes of every workflow. */
  workflowId?: string;
  className?: string;
}

/**
 * The note on the screen shown after the editor, when the save made on leaving it failed: "Não deu para salvar a última
 * mudança de {workflow}.". The change is only in the module's memory (never in `localStorage` nor `sessionStorage`).
 * - Saving again may work (no connection, server error, conflict) and the person can edit: "Voltar ao editor", and the
 *   note stays until the reopened editor saves the change.
 * - It would fail again (invalid definition, no permission, workflow removed), or the person can no longer edit: the
 *   note says why, without the button, and is gone once this screen is left (nothing more can be done with it).
 * Nothing when every change was saved.
 */
export function UnsavedChangesNotice({ onReturn, workflowId, className }: UnsavedChangesNoticeProps) {
  const queryClient = useQueryClient();
  const session = useSession();
  const canEdit = session.hasPermission(WORKFLOWS_EDIT_PERMISSION);
  const changes = useUnsavedDraftChanges(draftOwner(session.data)).filter(
    (change) => workflowId === undefined || change.workflowId === workflowId,
  );
  const canReturn = (change: UnsavedDraftChange) => change.recoverable && canEdit;
  const dead = changes.filter((change) => !canReturn(change));

  // The notes without a way back that were on screen are dropped when this screen goes away. The drop waits a turn, so
  // the unmount and mount again of React's development mode (StrictMode) do not drop them while still on screen.
  const told = useRef(new Set<UnsavedDraftChange>());
  useEffect(() => {
    for (const change of dead) told.current.add(change);
  });
  const dropTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (dropTimer.current !== null) clearTimeout(dropTimer.current);
    dropTimer.current = null;
    const notes = told.current;
    return () => {
      dropTimer.current = setTimeout(() => {
        dropTimer.current = null;
        for (const change of notes) dropUnsavedChange(queryClient, change);
        notes.clear();
      }, 0);
    };
  }, [queryClient]);

  if (changes.length === 0) return null;

  return (
    <div className={['fc-unsaved-changes', className].filter(Boolean).join(' ')}>
      {changes.map((change) => {
        const what = change.workflowName
          ? `Não deu para salvar a última mudança de ${change.workflowName}.`
          : 'Não deu para salvar a última mudança deste workflow.';
        if (!canReturn(change)) {
          return (
            <Notice key={change.workflowId} type="error" title={what}>
              {change.recoverable ? NO_PERMISSION_MESSAGE : saveErrorMessage(change.error)}
            </Notice>
          );
        }
        return (
          <Notice
            key={change.workflowId}
            type="error"
            actions={
              <Button size="small" onClick={() => onReturn(change.workflowId)}>
                Voltar ao editor
              </Button>
            }
          >
            {what}
          </Notice>
        );
      })}
    </div>
  );
}
