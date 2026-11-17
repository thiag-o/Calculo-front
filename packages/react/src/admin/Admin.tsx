import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ApiError } from '../api';
import { Notice, Button, Card, Loading, EmptyState } from '../design-system';
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
 * The whole Admin: internal tabs Usuários, Papéis, Integração and Segurança, each one only for whoever has its
 * permission (`ADMIN_TAB_PERMISSIONS`). It is the same screen in the shell menu, in the embedded mode tab and standalone.
 * Standalone, the tabs do not touch the URL. Needs `ApiProvider`, `QueryClientProvider` and `FluxoRoot` (portals
 * of dialogs and menus).
 */
export function Admin({ tab, onTabChange }: AdminProps = {}) {
  const session = useSession();
  const [localChoice, setLocalChoice] = useState<AdminTab | null>(null);
  const chosen = tab ?? localChoice;
  const baseId = useId();
  const buttons = useRef(new Map<AdminTab, HTMLButtonElement>());

  // With a session in the cache, an error on a new fetch does not take the screen down; without it, shows the fetch state.
  if (!session.data) {
    if (session.isError) {
      const detail = session.error instanceof ApiError ? session.error.message : 'Tente de novo em instantes.';
      return (
        <div className="fc-admin">
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
        </div>
      );
    }
    return (
      <div className="fc-admin">
        <Loading label="Carregando a Administração" rows={4} />
      </div>
    );
  }

  const visible = TABS.filter((item) => session.hasPermission(ADMIN_TAB_PERMISSIONS[item.id]));
  // The chosen tab may stop being valid (another tenant, roles changed): the first allowed one stays.
  const current = visible.find((item) => item.id === chosen) ?? visible[0];

  if (!current) {
    return (
      <div className="fc-admin">
        <Card as="div">
          <EmptyState
            title="Nenhuma área da Administração disponível para você"
            description="Peça ao administrador do cliente as permissões de que precisa."
          />
        </Card>
      </div>
    );
  }

  const tabId = (id: AdminTab) => `${baseId}-aba-${id}`;
  const panelId = `${baseId}-painel`;

  // Choosing the tab that is already open notifies nobody (in the module, it does not push the same route onto the history).
  function choose(id: AdminTab) {
    if (id === current?.id) return;
    setLocalChoice(id);
    onTabChange?.(id);
  }

  function activate(destination: TabDefinition) {
    choose(destination.id);
    buttons.current.get(destination.id)?.focus();
  }

  // Tab keyboard (WAI-ARIA, automatic activation): arrows move and choose, Home and End go to the ends.
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = visible.findIndex((item) => item.id === current?.id);
    const destinations: Record<string, number> = {
      ArrowRight: (index + 1) % visible.length,
      ArrowLeft: (index - 1 + visible.length) % visible.length,
      Home: 0,
      End: visible.length - 1,
    };
    const destination = destinations[event.key];
    const target = destination === undefined ? undefined : visible[destination];
    if (!target) return;
    event.preventDefault();
    activate(target);
  }

  return (
    <div className="fc-admin">
      <div className="fc-admin-tabs">
        <div className="fc-admin-tabs-list" role="tablist" aria-label="Administração" onKeyDown={handleKeyDown}>
          {visible.map((item) => {
            const selected = item.id === current.id;
            return (
              <button
                key={item.id}
                ref={(element) => {
                  if (element) buttons.current.set(item.id, element);
                  else buttons.current.delete(item.id);
                }}
                type="button"
                role="tab"
                id={tabId(item.id)}
                className="fc-admin-tab"
                aria-selected={selected}
                aria-controls={panelId}
                tabIndex={selected ? 0 : -1}
                onClick={() => choose(item.id)}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
      {/* The panel starts with a title, which does not take focus: the panel itself enters the Tab order. */}
      <div
        key={current.id}
        id={panelId}
        role="tabpanel"
        aria-labelledby={tabId(current.id)}
        tabIndex={0}
        className="fc-admin-panel"
      >
        {current.content()}
      </div>
    </div>
  );
}
