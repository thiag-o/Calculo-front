import { useEffect, useState } from 'react';
import { Button, Notice, Text } from '../../design-system';
import { useDraftEditor, type SaveStatus } from './DraftEditor';
import { CONFLICT_MESSAGE, CONFLICT_TITLE, saveErrorMessage } from './messages';
import { savedAgo } from './savedAgo';

/** "Salvo há…" is rewritten this often (ms). */
const TICK_MS = 30_000;

/** Only what needs the person's attention is announced: each save by itself would talk every 2 s of typing. */
const announcements: Record<SaveStatus, string> = {
  saved: '',
  pending: '',
  saving: '',
  error: 'Não foi possível salvar o rascunho',
  conflict: 'O rascunho não foi salvo: ele mudou em outra aba ou por outra pessoa',
};

/**
 * The editor bar's save state (E4-20, E4-23): "Salvando…" while the `PUT` runs, "Salvo há…" otherwise (rewritten every
 * 30 s), "Não foi possível salvar" after a failure and "Não salvo" in a conflict. The screen reader hears only the failure
 * and the conflict, not each save nor the passing minutes.
 */
export function SaveIndicator() {
  const { save, readOnly } = useDraftEditor();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(timer);
  }, [save.savedAt, save.status]);

  let text: string;
  let tone: 'tertiary' | 'danger' = 'tertiary';
  if (save.status === 'saving') text = 'Salvando…';
  else if (save.status === 'error') {
    text = 'Não foi possível salvar';
    tone = 'danger';
  } else if (save.status === 'conflict') {
    text = 'Não salvo';
    tone = 'danger';
  } else text = savedAgo(save.savedAt, now);

  return (
    <span className="fc-editor-save">
      <Text as="span" variant="label-13" emphasis={tone === 'danger' ? undefined : 'tertiary'} className={tone === 'danger' ? 'fc-editor-save-failed' : undefined}>
        {text}
      </Text>
      {readOnly ? null : (
        <span className="fc-visually-hidden" role="status">
          {announcements[save.status]}
        </span>
      )}
    </span>
  );
}

/**
 * The notes under the editor bar: the `409 draft_conflict` with "Recarregar rascunho" (E4-23; nothing is merged) and the
 * failed save with "Tentar de novo". Nothing when the saving is fine.
 */
export function SaveNotices() {
  const { save, retrySave, reload, reloadState } = useDraftEditor();

  if (save.status === 'conflict') {
    return (
      <Notice
        type="warning"
        title={CONFLICT_TITLE}
        className="fc-editor-notice"
        actions={
          <Button size="small" loading={reloadState.reloading} onClick={() => void reload()}>
            Recarregar rascunho
          </Button>
        }
      >
        {reloadState.error ? `Não foi possível recarregar o rascunho. ${saveErrorMessage(reloadState.error)}` : CONFLICT_MESSAGE}
      </Notice>
    );
  }

  if (save.status === 'error') {
    return (
      <Notice
        type="error"
        title="Não foi possível salvar o rascunho"
        className="fc-editor-notice"
        actions={
          <Button size="small" onClick={retrySave}>
            Tentar de novo
          </Button>
        }
      >
        {saveErrorMessage(save.error)}
      </Notice>
    );
  }

  return null;
}
