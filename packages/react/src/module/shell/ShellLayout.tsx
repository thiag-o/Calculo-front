import { useId, useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { Notice, Button, Tooltip } from '../../design-system';
import type { Session } from '../../session';
import { ExpandMenuIcon, CollapseMenuIcon } from '../icons';
import { groupBySection, type ScreenDefinition, type MenuGroup } from '../screens';
import { signOutErrorMessage, switchErrorMessage } from './messages';
import { UserMenu } from './UserMenu';
import { TenantSelector } from './TenantSelector';
import { useNarrowWidth } from './useNarrowWidth';
import './shell.css';

export interface ShellLayoutProps {
  session: Session;
  /** Only the screens the user can see in the current tenant. */
  screens: readonly ScreenDefinition[];
}

/**
 * Shell app layout (design.md §15, estilos.md §9 and §15): single 240px sidebar, with the tenant selector at the
 * top, the items by permission and whoever is signed in at the footer. The menu can be collapsed and becomes icons only (64px,
 * name in the tooltip) when the module is narrower than 1180px.
 */
export function ShellLayout({ session, screens }: ShellLayoutProps) {
  const reference = useRef<HTMLDivElement>(null);
  const narrow = useNarrowWidth(reference);
  const [collapsed, setCollapsed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const navigationId = useId();
  const compact = narrow || collapsed;
  const { unsectioned, sections } = groupBySection(screens);

  const classes = ['fc-shell', compact ? 'fc-shell-compact' : null, narrow ? 'fc-shell-narrow' : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={reference} className={classes}>
      <aside className="fc-sidebar" aria-label="Menu lateral">
        <div className="fc-sidebar-top">
          <TenantSelector
            session={session}
            onSwitch={() => setNotice(null)}
            onFailure={(error) => setNotice(switchErrorMessage(error))}
          />
        </div>

        <nav id={navigationId} className="fc-sidebar-nav" aria-label="Navegação principal">
          {unsectioned.map((screen) => (
            <SidebarItem key={screen.id} screen={screen} compact={compact} />
          ))}
          {sections.map((group) => (
            <SidebarSection key={group.section} group={group} compact={compact} />
          ))}
        </nav>

        <div className="fc-sidebar-footer">
          <UserMenu user={session.usuario} onFailure={(error) => setNotice(signOutErrorMessage(error))} />
          {/* Below 1180px the menu is icons only anyway: there is nothing to expand. */}
          {narrow ? null : (
            <Button
              iconOnly
              variant="ghost"
              size="small"
              className="fc-sidebar-toggle"
              label={collapsed ? 'Expandir menu' : 'Recolher menu'}
              icon={collapsed ? <ExpandMenuIcon /> : <CollapseMenuIcon />}
              aria-expanded={!collapsed}
              aria-controls={navigationId}
              onClick={() => setCollapsed((current) => !current)}
            />
          )}
        </div>
      </aside>

      <main className="fc-module-content">
        <div className="fc-module-page">
          {notice ? (
            <Notice
              type="error"
              actions={
                <Button size="small" onClick={() => setNotice(null)}>
                  Fechar aviso
                </Button>
              }
            >
              {notice}
            </Notice>
          ) : null}
          <Outlet />
        </div>
      </main>
    </div>
  );
}

/**
 * Menu section (e.g. Administração, in the menu footer): tertiary `label-12` label above the items (estilos.md §9).
 * With icons only, the label goes out of view (estilos.md §15), but still names the group for the screen reader.
 */
function SidebarSection({ group, compact }: { group: MenuGroup; compact: boolean }) {
  const labelId = useId();
  return (
    <div className="fc-sidebar-section" role="group" aria-labelledby={labelId}>
      <span id={labelId} className="fc-sidebar-section-label">
        {group.label}
      </span>
      {group.screens.map((screen) => (
        <SidebarItem key={screen.id} screen={screen} compact={compact} />
      ))}
    </div>
  );
}

function SidebarItem({ screen, compact }: { screen: ScreenDefinition; compact: boolean }) {
  const link = (
    <NavLink to={`/${screen.path}`} className="fc-sidebar-item">
      <span className="fc-sidebar-item-icon" aria-hidden="true">
        {screen.icon}
      </span>
      <span className="fc-sidebar-item-label">{screen.label}</span>
    </NavLink>
  );
  // With icons only, the name shows in the tooltip (estilos.md §15); the label stays on the link for the screen reader.
  return compact ? (
    <Tooltip content={screen.label} side="right">
      {link}
    </Tooltip>
  ) : (
    link
  );
}
