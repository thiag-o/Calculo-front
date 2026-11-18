import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Admin, ADMIN_TAB_PERMISSIONS, type AdminTab } from '../admin';
import { Audit } from '../audit';
import { Catalog, CATALOG_PERMISSION, type CatalogLocation, type CatalogTab } from '../catalog';
import { Home } from '../home';
import { AdminIcon, AuditIcon, CatalogIcon, HomeIcon } from './icons';

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
 * - `audit`: Auditoria (`audit.view`);
 * - `admin`: Administração, on the first allowed area;
 * - `users`, `roles`, `integration` and `security`: Administração already on one area, each with its own permission.
 * Without the permission, the module opens on the first allowed screen.
 */
export type FluxoScreen = 'home' | 'catalog' | 'audit' | MenuSection | AdminTab;

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
 * The module screens, in menu order (design.md §15): Início, Catálogo and Auditoria; then the Administração section, with
 * Usuários, Papéis, Integração and Segurança, each with its area's permission. The sidebar items and the embedded mode
 * tabs are the same: Início, Catálogo, Auditoria and Administração.
 */
export const SCREENS: readonly (ScreenDefinition & { id: FluxoScreen })[] = [
  { id: 'home', label: 'Início', path: 'home', icon: <HomeIcon />, content: <Home /> },
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
