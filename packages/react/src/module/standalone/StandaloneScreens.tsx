import type { ReactNode } from 'react';
import { Admin as AdminScreen, ADMIN_TAB_PERMISSIONS } from '../../admin';
import { Audit as AuditScreen } from '../../audit';
import { Home as HomeScreen } from '../../home';
import { useSession } from '../../session';
import { ModuleLoading, ModuleError, NoAccess } from '../ModuleStates';
import type { FluxoCalculoProps } from '../FluxoCalculo';
import { ModuleProvider } from '../ModuleProvider';
import { ModuleRouter } from '../router/ModuleRouter';

/**
 * Props of a standalone screen: the same as `<FluxoCalculo>`, minus `screen` and `navigation`. The navigation of a standalone
 * screen is always in memory: it touches neither the URL nor the host app history.
 */
export type StandaloneScreenProps = Pick<FluxoCalculoProps, 'apiUrl' | 'token' | 'theme' | 'onEvent' | 'onSessionExpired'>;

export type HomeProps = StandaloneScreenProps;
export type AdminProps = StandaloneScreenProps;
export type AuditProps = StandaloneScreenProps;

interface StandaloneDefinition {
  /** Screen name: label of the region that wraps it. */
  name: string;
  /** The name with the article, for the loading and error states (e.g. `a Auditoria`). */
  target: string;
  /** Who can see the screen in the current tenant, and the title of the "no access" state. Without it, the screen is open to everyone. */
  access?: {
    allowed: (hasPermission: (code: string) => boolean) => boolean;
    noAccess: string;
  };
  content: ReactNode;
}

/**
 * A module screen mounted on its own: the internal provider (root, API, cache and session end), the wait for the
 * session, the permission check and an in-memory router, isolated from the host app router. No module menu or
 * tabs: only the screen, in a named region (the host app page already has its own `main`).
 */
function StandaloneScreen({ definition, ...props }: StandaloneScreenProps & { definition: StandaloneDefinition }) {
  const { apiUrl, token, theme, onSessionExpired } = props;
  return (
    <ModuleProvider apiUrl={apiUrl} token={token} theme={theme} onSessionExpired={onSessionExpired}>
      <section className="fc-module-content" aria-label={definition.name}>
        <StandaloneContent definition={definition} />
      </section>
    </ModuleProvider>
  );
}

function StandaloneContent({ definition }: { definition: StandaloneDefinition }) {
  const session = useSession();

  // With a session in the cache, an error on a new fetch does not take the screen down; without it, shows the fetch state.
  if (!session.data) {
    if (session.isError) {
      return (
        <ModuleError
          target={definition.target}
          error={session.error}
          retrying={session.isFetching}
          onRetry={() => void session.refetch()}
        />
      );
    }
    return <ModuleLoading target={definition.target} />;
  }

  const { access } = definition;
  if (access && !access.allowed(session.hasPermission)) return <NoAccess title={access.noAccess} />;

  return (
    <ModuleRouter navigation="memory" initialPath="/">
      <div className="fc-module-page">{definition.content}</div>
    </ModuleRouter>
  );
}

const HOME_SCREEN: StandaloneDefinition = {
  name: 'Início',
  target: 'o Início',
  content: <HomeScreen />,
};

const AUDIT_SCREEN: StandaloneDefinition = {
  name: 'Auditoria',
  target: 'a Auditoria',
  access: {
    allowed: (hasPermission) => hasPermission('auditoria.ver'),
    noAccess: 'Você não tem acesso à Auditoria',
  },
  content: <AuditScreen />,
};

const ADMIN_SCREEN: StandaloneDefinition = {
  name: 'Administração',
  target: 'a Administração',
  access: {
    // One area is enough: the screen shows only the allowed tabs.
    allowed: (hasPermission) => Object.values(ADMIN_TAB_PERMISSIONS).some(hasPermission),
    noAccess: 'Você não tem acesso à Administração',
  },
  content: <AdminScreen />,
};

/** The Home screen, on its own, outside `<FluxoCalculo>`. Open to everyone. */
export function Home(props: HomeProps) {
  return <StandaloneScreen {...props} definition={HOME_SCREEN} />;
}

/**
 * The Admin, on its own, outside `<FluxoCalculo>`: the Usuários, Papéis, Integração and Segurança tabs the person
 * can see, switched without touching the URL. Without any of them, shows the "no access" state.
 */
export function Admin(props: AdminProps) {
  return <StandaloneScreen {...props} definition={ADMIN_SCREEN} />;
}

/** The Audit, on its own, outside `<FluxoCalculo>`. Requires `auditoria.ver`; without it, shows the "no access" state. */
export function Audit(props: AuditProps) {
  return <StandaloneScreen {...props} definition={AUDIT_SCREEN} />;
}
