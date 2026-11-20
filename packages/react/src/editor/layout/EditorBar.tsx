import { Badge, Button } from '../../design-system';
import { READ_ONLY_REASON, SaveIndicator } from '../draft';
import { ProblemCounter } from '../problems';
import { ArrowLeftIcon } from './icons';

export interface EditorBarProps {
  /** The workflow name, in the path. Without it (still loading), "Workflow". */
  workflowName?: string;
  /** ← : back to the workflow Overview. */
  onBack: () => void;
  /** Opens the workflow list (the "Workflows" of the path). Without it, the path shows the word only. */
  onOpenWorkflows?: () => void;
  readOnly: boolean;
  /** "● N problemas": opens the Problems tab. */
  onOpenProblems: () => void;
}

/**
 * The editor bar (E4-20; estilos.md §9 and §16): ←, the path (Workflows / name), the "Rascunho" badge, "Só leitura"
 * without `workflows.edit`, the clickable "● N problemas" and "Salvo há…". Testes, Simular and Enviar para revisão come
 * with their epics.
 */
export function EditorBar({ workflowName, onBack, onOpenWorkflows, readOnly, onOpenProblems }: EditorBarProps) {
  return (
    <>
      <Button
        className="fc-editor-back"
        variant="ghost"
        size="small"
        iconOnly
        icon={<ArrowLeftIcon size={14} />}
        label="Voltar para a visão geral"
        onClick={onBack}
      />
      <nav aria-label="Você está em">
        <ol className="fc-editor-crumb">
          <li>
            {onOpenWorkflows ? (
              <button type="button" className="fc-editor-crumb-link" onClick={onOpenWorkflows}>
                Workflows
              </button>
            ) : (
              <span className="fc-editor-crumb-text">Workflows</span>
            )}
          </li>
          <li>
            <span className="fc-editor-crumb-separator" aria-hidden="true">
              /
            </span>
            <span className="fc-editor-crumb-current" aria-current="page">
              {workflowName ?? 'Workflow'}
            </span>
          </li>
        </ol>
      </nav>
      <Badge>Rascunho</Badge>
      {readOnly ? (
        <>
          <Badge>Só leitura</Badge>
          <span className="fc-visually-hidden">{READ_ONLY_REASON}</span>
        </>
      ) : null}
      <ProblemCounter onOpen={onOpenProblems} />
      <SaveIndicator />
    </>
  );
}
