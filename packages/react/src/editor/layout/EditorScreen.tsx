import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, Loading, Notice, Skeleton } from '../../design-system';
import { useSession } from '../../session';
import { WORKFLOWS_EDIT_PERMISSION, useWorkflow } from '../../workflows';
import {
  DraftEditorProvider,
  SaveNotices,
  canRetryLoad,
  draftOwner,
  findUnsavedChange,
  loadErrorMessage,
  useDraft,
  useDraftEditor,
  useUndoShortcuts,
  type Draft,
  type EditorItem,
  type UnsavedDraftChange,
  type WorkflowProblem,
} from '../draft';
import { ProblemList, useProblemCounts } from '../problems';
import { EditorBar } from './EditorBar';
import { EditorLayout, findBottomTab, type BottomTab } from './EditorLayout';
import { ArrowLeftIcon } from './icons';
import './editor-layout.css';

/** The value of the Problems tab of the bottom panel. */
export const PROBLEMS_TAB = 'problems';

export interface EditorScreenProps {
  workflowId: string;
  /** ← : back to the workflow Overview. */
  onBack: () => void;
  /** Opens the workflow list (the "Workflows" of the path). */
  onOpenWorkflows?: () => void;
  /** The panels' content. Rendered inside the draft context: they read and change the draft with `useDraftEditor`. */
  layers?: ReactNode;
  canvas?: ReactNode;
  properties?: ReactNode;
  /** Tabs of the bottom panel after Problemas (e.g. Calcular). */
  bottomTabs?: readonly BottomTab[];
  /** After a problem of the Problems tab selects its block and field. */
  onSelectProblem?: (item: EditorItem, problem: WorkflowProblem) => void;
}

/**
 * The workflow editor screen (E4-20, E4-23): loads the draft and the session, keeps the local edit
 * (`DraftEditorProvider`) and lays out the bar, the panels and the bottom panel with the Problems tab. Without
 * `workflows.edit`, the draft opens read-only. States: loading (skeleton with the editor's shape), error (with "Tentar de
 * novo" when it may help), the draft, and the empty Problems tab. Needs `ApiProvider`, `QueryClientProvider` and
 * `FluxoRoot`.
 */
export function EditorScreen(props: EditorScreenProps) {
  // Another workflow is another editor: nothing of the previous one (its definition, history, revision, the "opened"
  // draft) may reach the next one, even when the screen is reused with a new `workflowId`.
  return <WorkflowEditor key={props.workflowId} {...props} />;
}

interface Opened {
  draft: Draft;
  /** The change the previous editor of this workflow could not save on close, if any: the editor starts from it. */
  unsaved: UnsavedDraftChange | null;
}

function WorkflowEditor({ workflowId, onBack, ...panels }: EditorScreenProps) {
  const queryClient = useQueryClient();
  const session = useSession();
  const draft = useDraft(workflowId);
  const owner = draftOwner(session.data);
  // The draft the editor starts from: the one read after the screen opened (never the cache alone, which may be older
  // than a save that just finished), kept from then on. Later query states do not matter: a failed "Recarregar rascunho"
  // keeps the editor. The draft is read after the save on close of the previous editor settled, so a change it could
  // not save is already kept by then.
  const [opened, setOpened] = useState<Opened | null>(null);
  if (opened === null && draft.isFetchedAfterMount && draft.isSuccess && !draft.isFetching && !session.isPending) {
    setOpened({ draft: draft.data, unsaved: findUnsavedChange(queryClient, workflowId, owner) });
  }

  if (opened === null && draft.isFetchedAfterMount && draft.isError) {
    const retry = canRetryLoad(draft.error);
    return (
      <section className="fc-editor" aria-label="Editor">
        <div className="fc-editor-unavailable">
          <Button variant="ghost" size="small" icon={<ArrowLeftIcon size={14} />} onClick={onBack}>
            Voltar
          </Button>
          <Notice
            type="error"
            title="Não foi possível abrir o editor"
            actions={
              retry ? (
                <Button size="small" loading={draft.isFetching} onClick={() => void draft.refetch()}>
                  Tentar de novo
                </Button>
              ) : undefined
            }
          >
            {loadErrorMessage(draft.error)}
          </Notice>
        </div>
      </section>
    );
  }

  if (opened === null) {
    return (
      <section className="fc-editor" aria-label="Editor">
        <Loading label="Carregando o editor" className="fc-editor-loading">
          <div className="fc-editor-frame" data-widths="wide" data-bottom="open">
            <div className="fc-editor-bar">
              <Skeleton width={160} />
            </div>
            <div className="fc-editor-middle">
              <div className="fc-editor-layers fc-editor-skeleton-panel">
                <Skeleton width="70%" />
                <Skeleton width="55%" />
                <Skeleton width="60%" />
              </div>
              <div className="fc-editor-canvas" />
              <div className="fc-editor-properties fc-editor-skeleton-panel">
                <Skeleton width="40%" />
                <Skeleton />
                <Skeleton width="80%" />
              </div>
            </div>
            <div className="fc-editor-bottom" />
          </div>
        </Loading>
      </section>
    );
  }

  const readOnly = !session.hasPermission(WORKFLOWS_EDIT_PERMISSION);
  return (
    <DraftEditorProvider key={opened.draft.workflow_id} draft={opened.draft} readOnly={readOnly} owner={owner} unsaved={opened.unsaved}>
      <LoadedEditor draft={opened.draft} onBack={onBack} {...panels} />
    </DraftEditorProvider>
  );
}

function LoadedEditor({
  draft,
  onBack,
  onOpenWorkflows,
  layers,
  canvas,
  properties,
  bottomTabs = [],
  onSelectProblem,
}: Omit<EditorScreenProps, 'workflowId'> & { draft: Draft }) {
  const editor = useRef<HTMLElement>(null);
  const workflow = useWorkflow(draft.workflow_id);
  const { readOnly, save } = useDraftEditor();
  const counts = useProblemCounts();
  const onKeyDown = useUndoShortcuts();
  const [tab, setTab] = useState(PROBLEMS_TAB);
  const [collapsed, setCollapsed] = useState(false);
  const [focusProblems, setFocusProblems] = useState(0);
  const showNotices = save.status === 'conflict' || save.status === 'error';
  const hadNotices = useRef(showNotices);

  // The counter opens the Problems tab and takes the focus there, so the keyboard lands on the list.
  useEffect(() => {
    if (focusProblems > 0) findBottomTab(editor.current, PROBLEMS_TAB)?.focus();
  }, [focusProblems]);

  // When the note goes away ("Recarregar rascunho" or "Tentar de novo" worked), its button took the focus with it: the
  // focus goes back to the editor, unless it already went somewhere else.
  useEffect(() => {
    const element = editor.current;
    if (hadNotices.current && !showNotices && element) {
      const active = element.ownerDocument.activeElement;
      if (active === null || active === element.ownerDocument.body) element.focus();
    }
    hadNotices.current = showNotices;
  }, [showNotices]);

  const name = workflow.data?.name;
  const tabs: BottomTab[] = [
    { value: PROBLEMS_TAB, label: 'Problemas', count: counts.total, content: <ProblemList onSelectProblem={onSelectProblem} /> },
    ...bottomTabs,
  ];

  return (
    <EditorLayout
      ref={editor}
      label={name ? `Editor de ${name}` : 'Editor'}
      bar={
        <EditorBar
          workflowName={name}
          onBack={onBack}
          onOpenWorkflows={onOpenWorkflows}
          readOnly={readOnly}
          onOpenProblems={() => {
            setTab(PROBLEMS_TAB);
            setCollapsed(false);
            setFocusProblems((count) => count + 1);
          }}
        />
      }
      notices={showNotices ? <SaveNotices /> : null}
      layers={layers}
      canvas={canvas}
      properties={properties}
      bottomTabs={tabs}
      bottomTab={tab}
      onBottomTabChange={setTab}
      bottomCollapsed={collapsed}
      onBottomCollapsedChange={setCollapsed}
      onKeyDown={onKeyDown}
    />
  );
}
