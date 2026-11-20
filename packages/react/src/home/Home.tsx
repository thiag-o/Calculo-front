import { useRef, useState, type ReactNode } from 'react';
import { ApiError } from '../api';
import { Badge, Button, Card, EmptyState, Loading, Notice, Skeleton, Text } from '../design-system';
import { useSession } from '../session';
import {
  NewWorkflowDialog,
  WORKFLOWS_EDIT_PERMISSION,
  relativeTime,
  useWorkflowList,
  type Workflow,
  type WorkflowSummary,
} from '../workflows';
import './home.css';

const EXECUTIONS_REASON = 'Disponível quando houver um workflow publicado';
const NO_EDIT_REASON = 'Você não tem permissão para criar workflows';
const VIEW_PERMISSION = 'workflows.view';

/** How many recent workflows the Home shows (E4-25), the most recently changed first. */
export const RECENT_WORKFLOWS = 6;

export interface HomeScreenProps {
  /** Opens a workflow's Overview (the module goes to `/workflows/:id`). Without it, the names are plain text. */
  onOpenWorkflow?: (id: string) => void;
  /** Opens the whole workflow list. Without it, the link is not shown. */
  onOpenWorkflows?: () => void;
}

function count(total: number): string {
  return total === 1 ? '1 workflow recente' : `${total.toLocaleString('pt-BR')} workflows recentes`;
}

function blocks(total: number): string {
  return total === 1 ? '1 bloco' : `${total.toLocaleString('pt-BR')} blocos`;
}

function problems(total: number): string {
  return total === 1 ? '1 problema' : `${total.toLocaleString('pt-BR')} problemas`;
}

/**
 * Home screen (estilos.md §16): "Precisa de você", "Workflows recentes" (up to 6, with the real data, E4-25) and "Execuções
 * recentes". "Novo workflow" needs `workflows.edit`; without `workflows.view` the workflows are not shown at all. The
 * executions come in a later epic: that section shows its designed empty state (§14).
 */
export function Home({ onOpenWorkflow, onOpenWorkflows }: HomeScreenProps = {}) {
  const session = useSession();
  if (!session.hasPermission(VIEW_PERMISSION)) return <HomeFrame subtitle={null} action={null} workflows={null} />;
  return <HomeWithWorkflows onOpenWorkflow={onOpenWorkflow} onOpenWorkflows={onOpenWorkflows} />;
}

function HomeWithWorkflows({ onOpenWorkflow, onOpenWorkflows }: HomeScreenProps) {
  const session = useSession();
  const list = useWorkflowList({ limit: RECENT_WORKFLOWS });
  const [creating, setCreating] = useState(false);
  const topButton = useRef<HTMLButtonElement>(null);
  const emptyButton = useRef<HTMLButtonElement>(null);
  const canEdit = session.hasPermission(WORKFLOWS_EDIT_PERMISSION);
  const recent = list.data?.slice(0, RECENT_WORKFLOWS);

  const newWorkflow = (place: 'top' | 'empty') => (
    <Button
      ref={place === 'top' ? topButton : emptyButton}
      variant={place === 'top' ? 'primary' : 'secondary'}
      size={place === 'top' ? 'default' : 'small'}
      disabledReason={canEdit ? undefined : NO_EDIT_REASON}
      showReason="beside"
      onClick={() => setCreating(true)}
    >
      Novo workflow
    </Button>
  );

  function created(workflow: Workflow) {
    setCreating(false);
    onOpenWorkflow?.(workflow.id);
  }

  let subtitle: string | null = null;
  if (recent !== undefined) subtitle = recent.length === 0 ? 'Nenhum workflow ainda' : count(recent.length);

  let body: ReactNode;
  if (list.isPending) {
    body = (
      <Loading label="Carregando workflows recentes">
        <Card as="div">
          <Skeleton width="60%" />
          <Skeleton width="40%" />
        </Card>
      </Loading>
    );
  } else if (recent === undefined) {
    const noPermission = list.error instanceof ApiError && list.error.code === 'no_permission';
    body = (
      <Notice
        type="error"
        title="Não foi possível carregar os workflows"
        actions={
          noPermission ? undefined : (
            <Button size="small" loading={list.isFetching} onClick={() => void list.refetch()}>
              Tentar de novo
            </Button>
          )
        }
      >
        {noPermission ? 'Você não tem permissão para ver os workflows deste cliente.' : 'A lista não respondeu. Tente de novo.'}
      </Notice>
    );
  } else if (recent.length === 0) {
    body = (
      <Card as="div">
        <EmptyState
          title="Nenhum workflow ainda"
          description={
            canEdit ? 'Crie o primeiro workflow para começar a calcular.' : 'Quem edita workflows no cliente ainda não criou nenhum.'
          }
          action={newWorkflow('empty')}
        />
      </Card>
    );
  } else {
    const now = new Date();
    body = (
      <Card as="div" padding="none">
        <ul className="fc-home-recent">
          {recent.map((workflow) => (
            <RecentRow key={workflow.id} workflow={workflow} now={now} onOpen={onOpenWorkflow} />
          ))}
        </ul>
        {onOpenWorkflows ? (
          <div className="fc-home-recent-all">
            <Button variant="ghost" size="small" onClick={onOpenWorkflows}>
              Ver todos os workflows
            </Button>
          </div>
        ) : null}
      </Card>
    );
  }

  return (
    <>
      <HomeFrame subtitle={subtitle} action={recent?.length === 0 ? null : newWorkflow('top')} workflows={body} />
      {creating ? (
        <NewWorkflowDialog
          onClose={() => setCreating(false)}
          onCreated={created}
          focusOnClose={() => topButton.current ?? emptyButton.current}
        />
      ) : null}
    </>
  );
}

function RecentRow({ workflow, now, onOpen }: { workflow: WorkflowSummary; now: Date; onOpen?: (id: string) => void }) {
  const { draft } = workflow;
  return (
    <li className="fc-home-recent-row">
      <div className="fc-home-recent-main">
        {onOpen ? (
          <button type="button" className="fc-home-recent-open" onClick={() => onOpen(workflow.id)}>
            {workflow.name}
          </button>
        ) : (
          <Text as="span" variant="heading-14">
            {workflow.name}
          </Text>
        )}
        <Text as="span" variant="label-13" emphasis="secondary">
          Rascunho · {blocks(draft.node_count)}
        </Text>
      </div>
      <Text as="span" variant="label-12" emphasis="tertiary" className="fc-home-recent-edited">
        editado por {workflow.updated_by.name} {relativeTime(workflow.updated_at, now)}
      </Text>
      {draft.problem_count > 0 ? <Badge tone="amber">{problems(draft.problem_count)}</Badge> : null}
    </li>
  );
}

interface HomeFrameProps {
  /** The line under the title. `null`: none yet (loading) or no access to workflows. */
  subtitle: string | null;
  /** "Novo workflow". `null`: the person cannot see workflows. */
  action: ReactNode;
  /** The content of "Workflows recentes". `null`: the section is not shown. */
  workflows: ReactNode;
}

function HomeFrame({ subtitle, action, workflows }: HomeFrameProps) {
  return (
    <div className="fc-home">
      <header className="fc-home-top">
        <div className="fc-home-title">
          <Text as="h1" variant="heading-24">
            Início
          </Text>
          {subtitle ? (
            <Text as="p" variant="label-14" emphasis="secondary">
              {subtitle}
            </Text>
          ) : null}
        </div>
        {action}
      </header>

      <section className="fc-home-section" aria-labelledby="fc-home-needs">
        <Text as="h2" variant="heading-16" id="fc-home-needs">
          Precisa de você
        </Text>
        <Card as="div">
          <EmptyState
            title="Nada precisa de você agora"
            description="Aprovações, execuções com erro e alertas aparecem aqui, do mais urgente."
          />
        </Card>
      </section>

      {workflows ? (
        <section className="fc-home-section" aria-labelledby="fc-home-workflows">
          <Text as="h2" variant="heading-16" id="fc-home-workflows">
            Workflows recentes
          </Text>
          {workflows}
        </section>
      ) : null}

      <section className="fc-home-section" aria-labelledby="fc-home-executions">
        <Text as="h2" variant="heading-16" id="fc-home-executions">
          Execuções recentes
        </Text>
        <Card as="div">
          <EmptyState
            title="Nenhuma execução ainda"
            description="Publique uma versão e execute o primeiro lote."
            action={
              <Button size="small" disabledReason={EXECUTIONS_REASON} showReason="beside">
                Executar lote
              </Button>
            }
          />
        </Card>
      </section>
    </div>
  );
}
