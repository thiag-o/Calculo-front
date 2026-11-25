import { useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Admin, ADMIN_TAB_PERMISSIONS, type AdminTab } from '../admin';
import { Audit } from '../audit';
import { Catalog, CATALOG_PERMISSION, type CatalogLocation, type CatalogTab } from '../catalog';
import { Button } from '../design-system';
import { Editor, UnitRunResult, UnsavedChangesNotice } from '../editor';
import {
  ExecutionList,
  ExecutionPanel,
  NO_EXECUTION_LIST_CHOICES,
  ScheduleList,
  type ExecutionListChoices,
  type RenderRecordTrace,
} from '../executions';
import { Home } from '../home';
import { useSession } from '../session';
import { TestCases } from '../test-cases';
import { EXECUTIONS_VIEW_PERMISSION, Workflows, type WorkflowsLocation } from '../workflows';
import { ExecutionsTabs } from './ExecutionsTabs';
import { AdminIcon, AuditIcon, CatalogIcon, ExecutionsIcon, HomeIcon, WorkflowsIcon } from './icons';

/** Sidebar sections (estilos.md §9). Screens without a section stay at the top of the menu. */
export type MenuSection = 'admin';

/**
 * Each section is a single item of the sidebar (shell) and a single tab (embedded mode); its screens switch through the
 * screen's own internal tabs (ADR 0027):
 * - `label`: name of the item and of the tab;
 * - `path`: route that opens the section's first allowed screen (the item and the tab point to it, and stay active on any
 *   screen of the section);
 * - `icon`: 16px Lucide icon of the sidebar item.
 */
export const SECTIONS: Record<MenuSection, { label: string; path: string; icon: ReactNode }> = {
  admin: { label: 'Administração', path: 'admin', icon: <AdminIcon /> },
};

/**
 * The screens `<FluxoCalculo>` can open through the `screen` prop. Each epic adds its own.
 * - `home`: Início, open to everyone;
 * - `catalog`: Catálogo (`connections.view`);
 * - `workflows`: Workflows, with the list, the Overview, the workflow executions and the editor (`workflows.view`);
 * - `executions`: Execuções, the tenant list and the panel of each one (`executions.view`);
 * - `audit`: Auditoria (`audit.view`);
 * - `admin`: Administração, on the first allowed area;
 * - `users`, `roles`, `integration` and `security`: Administração already on one area, each with its own permission.
 * Without the permission, the module opens on the first allowed screen.
 */
export type FluxoScreen = 'home' | 'catalog' | 'workflows' | 'executions' | 'audit' | MenuSection | AdminTab;

/** A module screen: internal route and sidebar item (shell) or tab (embedded). */
export interface ScreenDefinition {
  id: string;
  /** Screen name in the menu and in the tab: a noun, without a final period (estilos.md §10). */
  label: string;
  /** Path of the internal route, without the leading slash. */
  path: string;
  /** 16px Lucide icon of the sidebar item. A screen inside a section has no item of its own (the section has the icon). */
  icon?: ReactNode;
  /** Required permission (e.g. `audit.view`). Without it, the screen shows neither in the menu nor in the tabs, and the route does not open. */
  permission?: string;
  /**
   * Section the screen belongs to. The whole section is a single sidebar item (shell, in the menu footer) and a single tab
   * (embedded mode), and the screen itself navigates between its screens with internal tabs.
   */
  section?: MenuSection;
  /** The screen owns the routes below its path (`path/*`, e.g. the Catalog details); without it, only `path` itself opens. */
  nested?: boolean;
  /**
   * Route (without the leading slash) that shows the same `content` full screen, as a sibling of the layout (shell
   * sidebar or embedded tabs), e.g. the workflow editor (E4-20).
   */
  fullScreenPath?: string;
  content: ReactNode;
}

/** Route path of an Admin area. */
const adminPath = (tab: AdminTab) => `${SECTIONS.admin.path}/${tab}`;

/**
 * The `<Admin>` inside the module, the same in the shell and in embedded mode: each internal tab is a route, so the
 * sidebar, the address and the `screen` prop open the right area.
 */
function RoutedAdmin({ tab }: { tab: AdminTab }) {
  const navigate = useNavigate();
  return <Admin tab={tab} onTabChange={(other) => void navigate(`/${adminPath(other)}`)} />;
}

const CATALOG_PATH = 'catalog';
const CATALOG_TABS: readonly CatalogTab[] = ['connections', 'datasets', 'files'];

/**
 * Reads the Catalog location from the address: `/catalog` (the Conexões list), `/catalog/connections/:id`,
 * `/catalog/datasets` and `/catalog/datasets/:id`, `/catalog/files` and `/catalog/files/:id`.
 */
function catalogLocation(pathname: string): CatalogLocation {
  const [, , tab, id] = pathname.split('/');
  const known = CATALOG_TABS.find((candidate) => candidate === tab);
  return { tab: known ?? 'connections', id: known && id ? safeDecode(id) : null };
}

/** `decodeURIComponent` that does not throw on a malformed address (`%zz`): the id stays as typed and the API answers "not found". */
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Route path of a Catalog location (the Conexões list is the Catalog's own path). */
function catalogPath({ tab, id }: CatalogLocation): string {
  if (id) return `/${CATALOG_PATH}/${tab}/${encodeURIComponent(id)}`;
  return tab === 'connections' ? `/${CATALOG_PATH}` : `/${CATALOG_PATH}/${tab}`;
}

/** The `<Catalog>` inside the module: the tab and the open item are the route, so the sidebar and the address agree. */
function RoutedCatalog() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  return <Catalog location={catalogLocation(pathname)} onLocationChange={(next) => void navigate(catalogPath(next))} />;
}

const WORKFLOWS_PATH = 'workflows';
const EDITOR_SEGMENT = 'editor';
export const WORKFLOWS_VIEW_PERMISSION = 'workflows.view';

/** Route path of the workflow editor. */
export const WORKFLOW_EDITOR_PATH = `${WORKFLOWS_PATH}/:id/${EDITOR_SEGMENT}`;

const EXECUTIONS_SEGMENT = 'executions';
const EXECUTIONS_PATH = 'executions';
const SCHEDULES_SEGMENT = 'schedules';
const TESTS_SEGMENT = 'tests';

/**
 * Reads the Workflows location from the address: `/workflows`, `/workflows/:id`, `/workflows/:id/executions`,
 * `/workflows/:id/executions/schedules` (the Agendamentos tab) and `/workflows/:id/editor`. `/workflows/:id/tests` is the module's
 * own route (see `RoutedWorkflows`).
 */
function workflowsLocation(pathname: string): WorkflowsLocation {
  const [, , id, segment, tab] = pathname.split('/');
  if (!id) return { view: 'list' };
  if (segment === EDITOR_SEGMENT) return { view: 'editor', id: safeDecode(id) };
  if (segment === EXECUTIONS_SEGMENT) {
    return { view: 'executions', id: safeDecode(id), tab: tab === SCHEDULES_SEGMENT ? 'schedules' : 'executions' };
  }
  return { view: 'overview', id: safeDecode(id) };
}

/** Route path of a Workflows location. */
function workflowsPath(location: WorkflowsLocation): string {
  if (location.view === 'list') return `/${WORKFLOWS_PATH}`;
  const base = `/${WORKFLOWS_PATH}/${encodeURIComponent(location.id)}`;
  if (location.view === 'editor') return `${base}/${EDITOR_SEGMENT}`;
  if (location.view === 'executions') {
    return location.tab === 'schedules' ? `${base}/${EXECUTIONS_SEGMENT}/${SCHEDULES_SEGMENT}` : `${base}/${EXECUTIONS_SEGMENT}`;
  }
  return base;
}

/** Route path of the panel of an execution. */
export function executionPath(id: string): string {
  return `/${EXECUTIONS_PATH}/${encodeURIComponent(id)}`;
}

/** Route path of the Agendamentos tab of a workflow, or of the tenant when the person has no access to Workflows. */
export function schedulesPath(workflowId: string, workflowsAllowed: boolean): string {
  return workflowsAllowed ? workflowsPath({ view: 'executions', id: workflowId, tab: 'schedules' }) : `/${EXECUTIONS_PATH}/${SCHEDULES_SEGMENT}`;
}


/**
 * The `<Workflows>` inside the module: the list, the Overview, the workflow executions and the editor are the route. The
 * editor fills the module (the router mounts it outside the sidebar and the tabs) and the module hands it over, so `workflows`
 * does not depend on `editor`. With `executions`, the screens also trigger a batch ("Executar lote") and open the panel of the
 * execution (`/executions/:id`); the standalone `<Workflows>` has no executions route and goes without.
 */
export function RoutedWorkflows({ executions = false }: { executions?: boolean }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const canViewExecutions = useSession().hasPermission(EXECUTIONS_VIEW_PERMISSION);
  // The panel remembers where it was opened from, so the standalone screen can go back there.
  const openExecution = executions ? (id: string) => void navigate(executionPath(id), { state: openedFrom(pathname) }) : undefined;
  // `/workflows/:id/tests` is the module's own screen, not the workflows' one: `workflows` does not import `test-cases`.
  const [, , testsId, segment] = pathname.split('/');
  if (executions && openExecution && testsId && segment === TESTS_SEGMENT) {
    // A simulation opens the panel of its execution, which takes `executions.view`; without it the screen stays where it is.
    const open = (id: string) => {
      if (canViewExecutions) openExecution(id);
    };
    return <TestCases key={testsId} workflowId={safeDecode(testsId)} onOpenExecution={open} />;
  }
  return (
    <Workflows
      location={workflowsLocation(pathname)}
      onLocationChange={(next) => void navigate(workflowsPath(next))}
      onOpenExecution={openExecution}
      renderEditor={(props) => (
        <div className="fc-module-fill">
          <Editor {...props} onOpenExecution={openExecution} />
        </div>
      )}
      renderUnsavedNotice={(props) => <UnsavedChangesNotice {...props} />}
    />
  );
}

/**
 * The trace of a stored record is the one of "Calcular", drawn by the editor with the definition the execution froze: the
 * module hands it to the panel, because `executions` never imports `editor` (ADR 0062). Outside the editor no block is selected.
 */
const renderRecordTrace: RenderRecordTrace = ({ trace, definition }) => <UnitRunResult run={trace} definition={definition} />;

/**
 * The standalone `<Workflows>`: the workflow screens and, once a batch is opened, the panel of the execution, in the same
 * in-memory router (`/executions/:id` is where "Executar lote" and the list take the person).
 */
export function WorkflowsWithExecutions() {
  const { pathname } = useLocation();
  const canViewExecutions = useSession().hasPermission(EXECUTIONS_VIEW_PERMISSION);
  // The panel needs `executions.view`: without it the address does not open it and the workflow screens stay.
  return pathname.startsWith(`/${EXECUTIONS_PATH}`) && canViewExecutions ? <RoutedExecutions standalone /> : <RoutedWorkflows executions />;
}

/**
 * Where the panel was opened from: an address of the module (`state.from`, set by whoever opens the panel). In the module the
 * panel goes back to the Agendamentos tab or to the screen of the bell; the workflow screens and another panel
 * (a loop A, B, A) do not count: it goes to its own list. The standalone `<Workflows>` goes back to the workflow screens.
 */
function panelOrigin(state: unknown, standalone: boolean): string | null {
  const from = typeof state === 'object' && state !== null ? (state as { from?: unknown }).from : undefined;
  if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//') || isPanelPath(from)) return null;
  if (standalone) return from.startsWith(`/${WORKFLOWS_PATH}`) ? from : null;
  return from.startsWith(`/${WORKFLOWS_PATH}`) ? null : from;
}

/** `/executions/:id`: the panel of one execution (not the list nor the Agendamentos tab). */
function isPanelPath(path: string): boolean {
  const [, root, id] = path.split('/');
  return root === EXECUTIONS_PATH && Boolean(id) && id !== SCHEDULES_SEGMENT;
}

/** The `state` that tells the panel where it was opened from. */
export function openedFrom(pathname: string): { from: string } {
  return { from: pathname };
}

/** The "Voltar" of the panel, by the screen it goes back to. */
function originLabel(from: string): string {
  if (from.startsWith(`/${EXECUTIONS_PATH}/${SCHEDULES_SEGMENT}`)) return 'Voltar para os agendamentos';
  // The standalone `<Executions>` has its list at the root of the in-memory router.
  if (from === '/' || from === `/${EXECUTIONS_PATH}`) return 'Voltar para execuções';
  if (!from.startsWith(`/${WORKFLOWS_PATH}`)) return 'Voltar';
  if (from.endsWith(`/${EDITOR_SEGMENT}`)) return 'Voltar para o editor';
  if (from.endsWith(`/${TESTS_SEGMENT}`)) return 'Voltar para os testes';
  if (from.includes(`/${EXECUTIONS_SEGMENT}`)) return 'Voltar para as execuções do workflow';
  return from === `/${WORKFLOWS_PATH}` ? 'Voltar para workflows' : 'Voltar para a visão geral';
}

/** Reads the open execution from the address: `/executions` (the list) and `/executions/:id` (the panel). */
function executionId(pathname: string): string | null {
  const [, , id] = pathname.split('/');
  return id ? safeDecode(id) : null;
}

/**
 * The Execuções inside the module: the tenant list at `/executions`, the schedules at `/executions/schedules` (the two tabs,
 * E7-24) and the panel of one at `/executions/:id`, with the trace of the record drawn by the editor. The workflow of each row
 * and a new batch open the panel; the panel goes back to the list. In the standalone `<Workflows>` (`standalone`) there is no
 * tenant list nor schedules: the panel goes back to where it was opened from (the Overview, the workflow executions or the
 * editor) or, without that, to the workflow list.
 */
export function RoutedExecutions({ standalone = false }: { standalone?: boolean }) {
  const { pathname, state } = useLocation();
  const navigate = useNavigate();
  const id = executionId(pathname);
  // The filters of the list stay here, not in the list: the list leaves the screen with the Agendamentos tab (and with the panel).
  const [choices, setChoices] = useState<ExecutionListChoices>(NO_EXECUTION_LIST_CHOICES);
  const openExecution = (opened: string) => void navigate(executionPath(opened), { state: openedFrom(pathname) });
  if (id === null || (!standalone && id === SCHEDULES_SEGMENT)) {
    const tab = id === null ? 'executions' : 'schedules';
    return (
      <ExecutionsTabs
        tab={tab}
        onTabChange={(next) => void navigate(next === 'schedules' ? `/${EXECUTIONS_PATH}/${SCHEDULES_SEGMENT}` : `/${EXECUTIONS_PATH}`)}
      >
        {tab === 'schedules' ? (
          <ScheduleList onOpenExecution={openExecution} />
        ) : (
          <ExecutionList onOpenExecution={openExecution} choices={choices} onChoicesChange={setChoices} />
        )}
      </ExecutionsTabs>
    );
  }
  const origin = panelOrigin(state, standalone) ?? (standalone ? `/${WORKFLOWS_PATH}` : `/${EXECUTIONS_PATH}`);
  return (
    <div className="fc-module-executions">
      <Button variant="ghost" size="small" className="fc-module-executions-back" onClick={() => void navigate(origin)}>
        {originLabel(origin)}
      </Button>
      {/* The overlapped execution opens in the same panel route, keeping where the panel was opened from. */}
      <ExecutionPanel
        key={id}
        executionId={id}
        renderRecordTrace={renderRecordTrace}
        onOpenExecution={(opened) => void navigate(executionPath(opened), { state })}
      />
    </div>
  );
}

/** The Home inside the module: the recent workflows open their Overview and "Ver todos" opens the list. */
function RoutedHome() {
  const navigate = useNavigate();
  return (
    <Home
      onOpenWorkflow={(id) => void navigate(workflowsPath({ view: 'overview', id }))}
      onOpenWorkflows={() => void navigate(workflowsPath({ view: 'list' }))}
    />
  );
}

/** An Admin area: route with its permission, inside the Administração section (internal tab of `<Admin>`). */
function adminArea(id: AdminTab, label: string): ScreenDefinition & { id: FluxoScreen } {
  return {
    id,
    label,
    path: adminPath(id),
    permission: ADMIN_TAB_PERMISSIONS[id],
    section: 'admin',
    content: <RoutedAdmin tab={id} />,
  };
}

/**
 * The module screens, in menu order (design.md §15): Início, Catálogo, Workflows, Execuções and Auditoria; then the Administração
 * section, with Usuários, Papéis, Integração and Segurança, each with its area's permission. The sidebar items and the
 * embedded mode tabs are the same: Início, Catálogo, Workflows, Execuções, Auditoria and Administração.
 */
export const SCREENS: readonly (ScreenDefinition & { id: FluxoScreen })[] = [
  { id: 'home', label: 'Início', path: 'home', icon: <HomeIcon />, content: <RoutedHome /> },
  {
    id: 'catalog',
    label: 'Catálogo',
    path: CATALOG_PATH,
    icon: <CatalogIcon />,
    permission: CATALOG_PERMISSION,
    nested: true,
    content: <RoutedCatalog />,
  },
  {
    id: 'workflows',
    label: 'Workflows',
    path: WORKFLOWS_PATH,
    icon: <WorkflowsIcon />,
    permission: WORKFLOWS_VIEW_PERMISSION,
    nested: true,
    fullScreenPath: WORKFLOW_EDITOR_PATH,
    content: <RoutedWorkflows executions />,
  },
  {
    id: 'executions',
    label: 'Execuções',
    path: EXECUTIONS_PATH,
    icon: <ExecutionsIcon />,
    permission: EXECUTIONS_VIEW_PERMISSION,
    nested: true,
    content: <RoutedExecutions />,
  },
  {
    id: 'audit',
    label: 'Auditoria',
    path: 'audit',
    icon: <AuditIcon />,
    permission: 'audit.view',
    content: <Audit />,
  },
  adminArea('users', 'Usuários'),
  adminArea('roles', 'Papéis'),
  adminArea('integration', 'Integração'),
  adminArea('security', 'Segurança'),
];

/** The screens the user can see in the current tenant. Items without permission do not show (design.md §15). */
export function allowedScreens(
  screens: readonly ScreenDefinition[],
  hasPermission: (code: string) => boolean,
): readonly ScreenDefinition[] {
  return screens.filter((screen) => screen.permission === undefined || hasPermission(screen.permission));
}

export interface MenuGroup {
  section: MenuSection;
  label: string;
  /** Section route, which opens its first screen. */
  path: string;
  icon: ReactNode;
  screens: readonly ScreenDefinition[];
}

/**
 * Splits the sidebar screens: the ones without a section, in the order they come, and the sections that have some screen, in the order of
 * each one's first screen. A section without allowed screens disappears: no sidebar item and no tab.
 */
export function groupBySection(screens: readonly ScreenDefinition[]): {
  unsectioned: readonly ScreenDefinition[];
  sections: readonly MenuGroup[];
} {
  const unsectioned: ScreenDefinition[] = [];
  const sections = new Map<MenuSection, ScreenDefinition[]>();
  for (const screen of screens) {
    if (screen.section === undefined) {
      unsectioned.push(screen);
      continue;
    }
    const group = sections.get(screen.section);
    if (group) group.push(screen);
    else sections.set(screen.section, [screen]);
  }
  return {
    unsectioned,
    sections: Array.from(sections, ([section, items]) => ({ section, ...SECTIONS[section], screens: items })),
  };
}

/**
 * The screen the module opens on: the one with the requested `id`; if the `id` is a section's, its first screen; otherwise (or without
 * permission), the first allowed screen.
 */
export function initialScreen(screens: readonly ScreenDefinition[], id: string | undefined): ScreenDefinition | undefined {
  if (id === undefined) return screens[0];
  return screens.find((screen) => screen.id === id) ?? screens.find((screen) => screen.section === id) ?? screens[0];
}
