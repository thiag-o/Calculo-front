import { useMemo, useRef, useState } from 'react';
import { Button, EmptyState, Loading, Notice, Skeleton, Text } from '../../design-system';
import { useDraftEditor } from '../draft';
import { useProblemCounts } from '../problems';
import { TableIcon } from './icons';
import {
  CONFLICT_MESSAGE,
  CONFLICT_REASON,
  CONFLICT_TITLE,
  NO_BATCH_SOURCE_REASON,
  PREVIEW_LABEL,
  RUN_PREVIEW_LABEL,
  isConflict,
  previewErrorMessage,
  problemsReason,
} from './messages';
import { PreviewResult } from './PreviewResult';
import { useLastPreview, usePreview, type PreviewRequest } from './queries';
import { formatCount } from './values';
import './preview.css';

/**
 * The "Prévia" tab of the bottom panel (E5-11, E5-20): "Rodar prévia" saves what is pending (`flush`) and runs the saved
 * draft over the first 500 records of the batch source. It is disabled with the reason while the draft has problems or
 * has no batch source. The last preview of the workflow stays in memory while the module is open (`useLastPreview`).
 * Inside the `DraftEditorProvider` (the editor screen mounts it).
 */
export function PreviewPanel() {
  const { workflowId, definition, symbols, readOnly, flush, save, revision, select, reload, reloadState } = useDraftEditor();
  const counts = useProblemCounts();
  const last = useLastPreview(workflowId);

  const [request, setRequest] = useState<PreviewRequest | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const runs = useRef(0);
  // A second click before the screen shows "running" (a double click) does nothing.
  const busy = useRef(false);
  const latest = useRef(definition);
  latest.current = definition;

  const run = usePreview(workflowId, request);
  const running = saving || run.isFetching;
  const conflict = isConflict(run.error) && request !== null && revision === request.revision;
  // A conflict already solved by "Recarregar rascunho" (the revision changed) is no longer shown.
  const showError = run.isError && (conflict || !isConflict(run.error));
  // The draft changed after the preview: its counts are of the definition before.
  const stale = useMemo(() => last !== null && JSON.stringify(last.definition) !== JSON.stringify(definition), [last, definition]);

  let disabledReason: string | undefined;
  if (counts.total > 0) disabledReason = problemsReason(counts.total);
  else if (!definition.root.batch_source) disabledReason = NO_BATCH_SOURCE_REASON;
  else if (save.status === 'conflict' || conflict) disabledReason = CONFLICT_REASON;

  async function runPreview() {
    if (disabledReason || running || busy.current) return;
    setSaveFailed(false);
    // What is saved now is what is on screen now: it names the blocks of the result.
    const snapshot = latest.current;
    // E4-23: the preview is of the saved draft, so what is pending is saved first. Read-only has nothing to save.
    let saved: number | null = revision;
    if (!readOnly) {
      busy.current = true;
      setSaving(true);
      try {
        saved = await flush();
      } finally {
        busy.current = false;
        setSaving(false);
      }
    }
    if (saved === null) {
      setSaveFailed(true);
      return;
    }
    runs.current += 1;
    setRequest({ id: runs.current, revision: saved, definition: snapshot });
  }

  let content;
  if (saveFailed && !running && save.status !== 'saved') {
    // Gone once the draft is saved again ("Tentar de novo" or "Recarregar rascunho" at the top of the editor).
    content = (
      <Notice type="error" title="O rascunho não foi salvo">
        A prévia roda o rascunho salvo. Resolva o aviso no topo do editor e rode a prévia de novo.
      </Notice>
    );
  } else if (running) {
    content = <PreviewSkeleton />;
  } else if (showError) {
    content = <PreviewError error={run.error} reloading={reloadState.reloading} reloadError={reloadState.error !== null} onReload={() => void reload()} />;
  } else if (last) {
    content = (
      <>
        {stale ? (
          <Text as="p" variant="label-13" emphasis="secondary" className="fc-preview-stale">
            Prévia de uma versão anterior do rascunho. Rode a prévia de novo para ver a atual.
          </Text>
        ) : null}
        <PreviewResult
          last={last}
          currentDefinition={definition}
          symbols={symbols}
          onSelectNode={(id) => select({ type: 'node', id })}
          onSelectBatchSource={() => select({ type: 'inputs' })}
        />
      </>
    );
  } else {
    content = (
      <EmptyState
        className="fc-preview-empty"
        icon={<TableIcon />}
        title="Nenhuma prévia ainda"
        description={
          definition.root.batch_source
            ? 'Clique em Rodar prévia para ver as contagens de cada bloco Fonte e os registros de exemplo de cada grupo.'
            : 'A prévia lê os registros da fonte do lote. Escolha a fonte do lote no painel do workflow.'
        }
      />
    );
  }

  return (
    <section className="fc-preview" aria-label={PREVIEW_LABEL}>
      <div className="fc-preview-head">
        <h3 className="fc-preview-title">{PREVIEW_LABEL}</h3>
        <Button variant="primary" size="small" loading={running} disabledReason={disabledReason} showReason="beside" onClick={() => void runPreview()}>
          {RUN_PREVIEW_LABEL}
        </Button>
      </div>
      <div className="fc-preview-body">{content}</div>
      <span className="fc-visually-hidden" role="status">
        {running ? '' : run.data && request ? `Prévia pronta: ${formatCount(run.data.counted_records)} registros contados` : ''}
      </span>
    </section>
  );
}

/** The loading skeleton, with the shape of the result (estilos.md §14): the note, a block with its counts and lines. */
function PreviewSkeleton() {
  return (
    <Loading label="Rodando a prévia" className="fc-preview-loading">
      <Skeleton width={220} />
      <div className="fc-preview-loading-item">
        <Skeleton width={140} />
        <div className="fc-preview-loading-counts">
          <Skeleton width={110} />
          <Skeleton width={150} />
          <Skeleton width={190} />
        </div>
        <Skeleton width="80%" />
        <Skeleton width="80%" />
        <Skeleton width="80%" />
      </div>
    </Loading>
  );
}

interface PreviewErrorProps {
  error: unknown;
  reloading: boolean;
  reloadError: boolean;
  onReload: () => void;
}

function PreviewError({ error, reloading, reloadError, onReload }: PreviewErrorProps) {
  if (isConflict(error)) {
    return (
      <Notice
        type="warning"
        title={CONFLICT_TITLE}
        actions={
          <Button size="small" loading={reloading} onClick={onReload}>
            Recarregar rascunho
          </Button>
        }
      >
        {reloadError ? 'Não foi possível recarregar o rascunho. Tente de novo em instantes.' : CONFLICT_MESSAGE}
      </Notice>
    );
  }
  const { title, message } = previewErrorMessage(error);
  return (
    <Notice type="error" title={title}>
      {message}
    </Notice>
  );
}
