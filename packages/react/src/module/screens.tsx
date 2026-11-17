import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Admin, ADMIN_TAB_PERMISSIONS, type AdminTab } from '../admin';
import { Audit } from '../audit';
import { Home } from '../home';
import { AuditIcon, HomeIcon, IntegrationIcon, RolesIcon, SecurityIcon, UsersIcon } from './icons';

/** Sidebar sections (estilos.md §9). Screens without a section stay at the top of the menu. */
export type MenuSection = 'admin';

/**
 * Each section:
 * - `label`: in the shell, above its items (tertiary `label-12`); in embedded mode, the name of its tab;
 * - `path`: route that opens the section's first allowed screen (the embedded mode tab points to it).
 */
export const SECTIONS: Record<MenuSection, { label: string; path: string }> = {
  admin: { label: 'Administração', path: 'admin' },
};

/**
 * The screens `<FluxoCalculo>` can open through the `screen` prop. Each epic adds its own.
 * - `home`: Início, open to everyone;
 * - `audit`: Auditoria (`audit.view`);
 * - `admin`: Administração, on the first allowed area;
 * - `users`, `roles`, `integration` and `security`: Administração already on one area, each with its own permission.
 * Without the permission, the module opens on the first allowed screen.
 */
export type FluxoScreen = 'home' | 'audit' | MenuSection | AdminTab;

/** A module screen: internal route and sidebar item (shell) or tab (embedded). */
export interface ScreenDefinition {
  id: string;
  /** Screen name in the menu and in the tab: a noun, without a final period (estilos.md §10). */
  label: string;
  /** Path of the internal route, without the leading slash. */
  path: string;
  /** 16px Lucide icon of the sidebar item. */
  icon: ReactNode;
  /** Required permission (e.g. `audit.view`). Without it, the screen shows neither in the menu nor in the tabs, and the route does not open. */
  permission?: string;
  /**
   * Section the screen belongs to. In the shell, the section groups the items in the sidebar (e.g. Administração, in the footer). In
   * embedded mode, the whole section is a single tab, and the screen itself navigates between its screens.
   */
  section?: MenuSection;
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

/** An Admin area: section item in the sidebar and route with its permission. */
function adminArea(id: AdminTab, label: string, icon: ReactNode): ScreenDefinition & { id: FluxoScreen } {
  return {
    id,
    label,
    path: adminPath(id),
    icon,
    permission: ADMIN_TAB_PERMISSIONS[id],
    section: 'admin',
    content: <RoutedAdmin tab={id} />,
  };
}

/**
 * The module screens, in menu order (design.md §15): Início and Auditoria; then the Administração section, with
 * Usuários, Papéis, Integração and Segurança, each with its area's permission. In embedded mode, the tabs are
 * Início, Auditoria and Administração.
 */
export const SCREENS: readonly (ScreenDefinition & { id: FluxoScreen })[] = [
  { id: 'home', label: 'Início', path: 'home', icon: <HomeIcon />, content: <Home /> },
  {
    id: 'audit',
    label: 'Auditoria',
    path: 'audit',
    icon: <AuditIcon />,
    permission: 'audit.view',
    content: <Audit />,
  },
  adminArea('users', 'Usuários', <UsersIcon />),
  adminArea('roles', 'Papéis', <RolesIcon />),
  adminArea('integration', 'Integração', <IntegrationIcon />),
  adminArea('security', 'Segurança', <SecurityIcon />),
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
  screens: readonly ScreenDefinition[];
}

/**
 * Splits the sidebar screens: the ones without a section, in the order they come, and the sections that have some screen, in the order of
 * each one's first screen. A section without allowed screens disappears entirely, with its label.
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
