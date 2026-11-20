import { useId, useRef, useState, type ReactNode } from 'react';
import { Badge, Button, Card, EmptyState, Loading, Menu, Notice, Skeleton, Text } from '../../design-system';
import { useSession } from '../../session';
import { EDIT_PERMISSION, relativeTime } from '../list';
import { useWorkflow, type Workflow } from '../queries';
import { DeleteWorkflowDialog } from './DeleteWorkflowDialog';
import { RenameWorkflowDialog } from './RenameWorkflowDialog';
import { BackIcon, ExecutionIcon, MoreActionsIcon, VersionIcon } from './icons';
import { isNoPermission, isNotFound, loadErrorMessage } from './messages';
import './overview.css';

export interface WorkflowOverviewProps {
  /** The workflow id (`/workflows/:id` in the module). */
  workflowId: string;
  /** Opens the editor (`/workflows/:id/editor`). Without `workflows.edit`, the editor opens read only. */
  onOpenEditor: (id: string) => void;
  /** Goes back to the workflow list. With it, the screen shows "Voltar para workflows". */
  onBack?: () => void;
  /**
   * Called after the workflow is removed (the module goes back to the list); the workflow and its draft have already
   * left the cache. Without it, the screen says it was removed.
   */
  onDeleted?: () => void;
}

/**
 * Workflow Overview (estilos.md §16, only what exists in epic 4): name and objective with "Abrir editor"; "Versão em
 * produção" and "Execuções" empty (versions and runs come in later epics); the draft in one row. With `workflows.edit`,
 * the "…" menu renames and removes. Needs `ApiProvider`, `QueryClientProvider` and `FluxoRoot` (menu and dialog portals).
 */
export function WorkflowOverview({ workflowId, onOpenEditor, onBack, onDeleted }: WorkflowOverviewProps) {
  // Kept by id: another workflow on the same screen starts fresh.
  const [deletedId, setDeletedId] = useState<string | null>(null);
  const back = onBack ? (
    <Button variant="ghost" size="small" icon={<BackIcon size={14} />} onClick={onBack} className="fc-workflow-overview-back">
      Voltar para workflows
    </Button>
  ) : null;

  // The query lives in the child: once removed, it unmounts and the workflow is not fetched again.
  if (deletedId === workflowId) {
    return (
      <Frame title="Workflow removido" back={back}>
        <Notice type="success">O workflow e o rascunho dele foram removidos.</Notice>
      </Frame>
    );
  }

  return (
    <OverviewContent
      workflowId={workflowId}
      back={back}
      onBack={onBack}
      onOpenEditor={onOpenEditor}
      onDeleted={() => {
        setDeletedId(workflowId);
        onDeleted?.();
      }}
    />
  );
}

function OverviewContent({
  workflowId,
  back,
  onBack,
  onOpenEditor,
  onDeleted,
}: {
  workflowId: string;
  back: ReactNode;
  onBack?: () => void;
  onOpenEditor: (id: string) => void;
  onDeleted: () => void;
}) {
  const session = useSession();
  const query = useWorkflow(workflowId);
  const workflow = query.data;

  if (!workflow && query.isError) {
    const notFound = isNotFound(query.error);
    return (
      <Frame title="Workflow" back={back}>
        <Notice
          type="error"
          title={notFound ? 'Workflow não encontrado' : 'Não foi possível abrir o workflow'}
          actions={
            notFound ? (
              onBack ? (
                <Button size="small" onClick={onBack}>
                  Voltar para workflows
                </Button>
              ) : undefined
            ) : isNoPermission(query.error) ? undefined : (
              <Button size="small" loading={query.isFetching} onClick={() => void query.refetch()}>
                Tentar de novo
              </Button>
            )
          }
        >
          {loadErrorMessage(query.error)}
        </Notice>
      </Frame>
    );
  }

  if (!workflow) {
    return (
      <Frame title="Workflow" back={back}>
        <Loading label="Carregando o workflow">
          <div className="fc-workflow-overview-loading">
            <Skeleton width="40%" />
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="fc-workflow-overview-loading-box">
                <Skeleton width={140} />
                <Skeleton width="60%" />
              </div>
            ))}
          </div>
        </Loading>
      </Frame>
    );
  }

  return (
    <LoadedOverview
      workflow={workflow}
      back={back}
      canEdit={session.hasPermission(EDIT_PERMISSION)}
      onOpenEditor={onOpenEditor}
      onDeleted={onDeleted}
    />
  );
}

type OpenDialog = 'rename' | 'delete' | null;

function LoadedOverview({
  workflow,
  back,
  canEdit,
  onOpenEditor,
  onDeleted,
}: {
  workflow: Workflow;
  back: ReactNode;
  canEdit: boolean;
  onOpenEditor: (id: string) => void;
  onDeleted: () => void;
}) {
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const moreButton = useRef<HTMLButtonElement>(null);

  return (
    <Frame
      title={workflow.name}
      back={back}
      objective={workflow.objective}
      actions={
        <>
          <Button variant="primary" onClick={() => onOpenEditor(workflow.id)}>
            Abrir editor
          </Button>
          {canEdit ? (
            <Menu
              trigger={
                <Button
                  ref={moreButton}
                  iconOnly
                  variant="ghost"
                  label={`Mais ações para ${workflow.name}`}
                  icon={<MoreActionsIcon />}
                />
              }
              items={[
                { label: 'Renomear', onSelect: () => setDialog('rename') },
                { label: 'Remover workflow', danger: true, onSelect: () => setDialog('delete') },
              ]}
            />
          ) : null}
        </>
      }
    >
      <Section title="Versão em produção">
        <Card>
          <EmptyState
            icon={<VersionIcon />}
            title="Nenhuma versão publicada"
            description="Quando uma versão do rascunho for aprovada, ela aparece aqui."
          />
        </Card>
      </Section>

      <Section title="Rascunho">
        <DraftRow workflow={workflow} />
      </Section>

      <Section title="Execuções">
        <Card>
          <EmptyState
            icon={<ExecutionIcon />}
            title="Nenhuma execução ainda"
            description="Publique uma versão e execute o primeiro lote."
          />
        </Card>
      </Section>

      {dialog === 'rename' ? (
        <RenameWorkflowDialog workflow={workflow} focusOnClose={moreButton} onClose={() => setDialog(null)} />
      ) : null}
      {dialog === 'delete' ? (
        <DeleteWorkflowDialog
          workflow={workflow}
          focusOnClose={moreButton}
          onClose={() => setDialog(null)}
          onDeleted={() => {
            setDialog(null);
            onDeleted();
          }}
        />
      ) : null}
    </Frame>
  );
}

function blocks(count: number): string {
  return count === 1 ? '1 bloco' : `${count.toLocaleString('pt-BR')} blocos`;
}

function problems(count: number): string {
  return count === 1 ? '1 problema' : `${count.toLocaleString('pt-BR')} problemas`;
}

/**
 * The draft in one row (estilos.md §7.6, "Linha de rascunho"): the revision in mono and the block count, who changed
 * it and when below, and the red problem-count badge on the right (estilos.md §7.4), when there are problems.
 */
function DraftRow({ workflow }: { workflow: Workflow }) {
  const { draft } = workflow;
  return (
    <Card className="fc-workflow-overview-draft">
      <div className="fc-workflow-overview-draft-text">
        <div className="fc-workflow-overview-draft-main">
          <Text variant="mono-13" medium>
            {`revisão ${draft.revision.toLocaleString('pt-BR')}`}
          </Text>
          <Text variant="label-14">{blocks(draft.node_count)}</Text>
        </div>
        <Text variant="label-13" emphasis="secondary">
          {`editado por ${draft.updated_by.name} ${relativeTime(draft.updated_at, new Date())}`}
        </Text>
      </div>
      {draft.problem_count > 0 ? <Badge tone="red">{problems(draft.problem_count)}</Badge> : null}
    </Card>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const titleId = useId();
  return (
    <section className="fc-workflow-overview-section" aria-labelledby={titleId}>
      <Text as="h2" variant="heading-16" id={titleId} className="fc-workflow-overview-section-title">
        {title}
      </Text>
      {children}
    </section>
  );
}

/** The page title (h1), the same in every state, with "Voltar para workflows" above it and the actions on the right. */
function Frame({
  title,
  back,
  objective,
  actions,
  children,
}: {
  title: string;
  back: ReactNode;
  objective?: string | null;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="fc-workflow-overview">
      {back}
      <header className="fc-workflow-overview-top">
        <div className="fc-workflow-overview-title">
          <Text as="h1" variant="heading-32" className="fc-workflow-overview-name">
            {title}
          </Text>
          {objective ? (
            <Text as="p" variant="copy-14" emphasis="secondary" className="fc-workflow-overview-objective">
              {objective}
            </Text>
          ) : null}
        </div>
        {actions ? <div className="fc-workflow-overview-actions">{actions}</div> : null}
      </header>
      {children}
    </div>
  );
}
