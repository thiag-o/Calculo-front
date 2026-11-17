import { ApiError } from '../api';
import { Notice, Button, Card, Loading, EmptyState } from '../design-system';
import { SignOutIcon, SecurityIcon } from './icons';

/** What is opening, with the article: the whole module or a standalone screen (e.g. `a Auditoria`). */
const MODULE_NAME = 'o Fluxo de Cálculo';

/** While the session arrives: skeleton, no spinner in the middle of the page (estilos.md §14). */
export function ModuleLoading({ target = MODULE_NAME }: { target?: string }) {
  return (
    <div className="fc-module-page">
      <Loading label={`Carregando ${target}`} rows={4} />
    </div>
  );
}

export interface ModuleErrorProps {
  error: Error;
  retrying: boolean;
  onRetry: () => void;
  /** What did not open, with the article. Default: `o Fluxo de Cálculo`. */
  target?: string;
}

/** The session did not load for a transient reason (network, server): says what happened and offers to try again. */
export function ModuleError({ error, retrying, onRetry, target = MODULE_NAME }: ModuleErrorProps) {
  const detail = error instanceof ApiError ? error.message : 'Tente de novo em instantes.';
  return (
    <div className="fc-module-page">
      <Notice
        type="error"
        title={`Não foi possível abrir ${target}`}
        actions={
          <Button size="small" loading={retrying} onClick={onRetry}>
            Tentar de novo
          </Button>
        }
      >
        {detail}
      </Notice>
    </div>
  );
}

/** No session (expired, revoked or the person signed out). The host app was already notified through `onSessionExpired`. */
export function EndedSession() {
  return (
    <div className="fc-module-page">
      <Card as="div">
        <EmptyState icon={<SignOutIcon />} title="A sessão terminou" description="Entre de novo para continuar." />
      </Card>
    </div>
  );
}

/** The user cannot see any screen in this tenant. */
export function NoScreens() {
  return (
    <div className="fc-module-page">
      <Card as="div">
        <EmptyState
          title="Nenhuma tela disponível para você"
          description="Peça ao administrador do cliente as permissões de que precisa."
        />
      </Card>
    </div>
  );
}

/**
 * No access to a standalone screen: its permission is missing in the current tenant. Empty state (estilos.md §7.7 and §14), without
 * action, because only the tenant administrator can fix it.
 */
export function NoAccess({ title }: { title: string }) {
  return (
    <div className="fc-module-page">
      <Card as="div">
        <EmptyState
          icon={<SecurityIcon />}
          title={title}
          description="Peça ao administrador do cliente as permissões de que precisa."
        />
      </Card>
    </div>
  );
}
