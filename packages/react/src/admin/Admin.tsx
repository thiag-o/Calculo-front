import { useState, type ReactNode } from 'react';
import { ApiError } from '../api';
import { Notice, Button, Card, Loading, EmptyState, Tabs, Text } from '../design-system';
import { useSession } from '../session';
import { Integration } from './integration';
import { Roles } from './roles';
import { Security } from './security';
import { Users } from './users';
import './admin.css';

/** The Admin areas, in the order of the tabs and of the menu. */
export type AdminTab = 'users' | 'roles' | 'integration' | 'security';

/**
 * The permission that opens each area (contract: the scope of each area's routes). The module uses the same ones in the sidebar
 * and in the embedded mode tabs, so the standalone screen and the module show the same areas to each person.
 */
export const ADMIN_TAB_PERMISSIONS = {
  users: 'users.manage',
  roles: 'roles.manage',
  integration: 'integration.manage',
  security: 'security.manage',
} as const satisfies Record<AdminTab, string>;

interface TabDefinition {
  id: AdminTab;
  /** Tab name: a noun, without a final period (estilos.md §10). */
  label: string;
  content: () => ReactNode;
}

const TABS: readonly TabDefinition[] = [
  { id: 'users', label: 'Usuários', content: () => <Users /> },
  { id: 'roles', label: 'Papéis', content: () => <Roles /> },
  { id: 'integration', label: 'Integração', content: () => <Integration /> },
  { id: 'security', label: 'Segurança', content: () => <Security /> },
];

export interface AdminProps {
  /**
   * Open tab, when whoever uses the screen controls the choice (`<FluxoCalculo>` binds each tab to a route). Without it, the
   * screen keeps the choice by itself and starts on the first allowed tab.
   */
  tab?: AdminTab;
  /** Called when the person picks another tab (click or keyboard). */
  onTabChange?: (tab: AdminTab) => void;
}

/**
 * The whole Admin: the "Administração" title (h1) and the internal tabs Usuários, Papéis, Integração and Segurança, each
 * one only for whoever has its permission (`ADMIN_TAB_PERMISSIONS`); each area opens with its own h2. It is the same screen
 * in the shell sidebar item, in the embedded mode tab and standalone.
 * Standalone, the tabs do not touch the URL. Needs `ApiProvider`, `QueryClientProvider` and `FluxoRoot` (portals
 * of dialogs and menus).
 */
export function Admin({ tab, onTabChange }: AdminProps = {}) {
  const session = useSession();
  const [localChoice, setLocalChoice] = useState<AdminTab | null>(null);
  const chosen = tab ?? localChoice;

  // With a session in the cache, an error on a new fetch does not take the screen down; without it, shows the fetch state.
  if (!session.data) {
    if (session.isError) {
      const detail = session.error instanceof ApiError ? session.error.message : 'Tente de novo em instantes.';
      return (
        <AdminFrame>
          <Notice
            type="error"
            title="Não foi possível abrir a Administração"
            actions={
              <Button size="small" loading={session.isFetching} onClick={() => void session.refetch()}>
                Tentar de novo
              </Button>
            }
          >
            {detail}
          </Notice>
        </AdminFrame>
      );
    }
    return (
      <AdminFrame>
        <Loading label="Carregando a Administração" rows={4} />
      </AdminFrame>
    );
  }

  const visible = TABS.filter((item) => session.hasPermission(ADMIN_TAB_PERMISSIONS[item.id]));
  // The chosen tab may stop being valid (another tenant, roles changed): the first allowed one stays.
  const current = visible.find((item) => item.id === chosen) ?? visible[0];

  if (!current) {
    return (
      <AdminFrame>
        <Card as="div">
          <EmptyState
            title="Nenhuma área da Administração disponível para você"
            description="Peça ao administrador do cliente as permissões de que precisa."
          />
        </Card>
      </AdminFrame>
    );
  }

  // Choosing the tab that is already open notifies nobody (in the module, it does not push the same route onto the history).
  function choose(id: AdminTab) {
    setLocalChoice(id);
    onTabChange?.(id);
  }

  return (
    <AdminFrame>
      <Tabs<AdminTab>
        label="Administração"
        size="small"
        className="fc-admin-tabs"
        items={visible.map((item) => ({ value: item.id, label: item.label }))}
        value={current.id}
        onValueChange={choose}
      >
        {current.content()}
      </Tabs>
    </AdminFrame>
  );
}

/** The screen title (h1), the same in every state, and below it the state or the tabs. */
function AdminFrame({ children }: { children: ReactNode }) {
  return (
    <div className="fc-admin">
      <Text as="h1" variant="heading-24">
        Administração
      </Text>
      {children}
    </div>
  );
}
