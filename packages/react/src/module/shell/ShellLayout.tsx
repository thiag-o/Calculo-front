import { useId, useRef, useState, type ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router';
import { Notice, Button, Tooltip } from '../../design-system';
import { useSessionGeneration, type Session } from '../../session';
import { ExpandMenuIcon, CollapseMenuIcon } from '../icons';
import { groupBySection, type ScreenDefinition } from '../screens';
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
 * top, the items by permission and whoever is signed in at the footer. Each section (Administração) is a single item at the
 * menu footer; its areas are the screen's internal tabs, as in embedded mode (ADR 0027). The menu can be collapsed and
 * becomes icons only (64px, name in the tooltip) when the module is narrower than 1180px.
 */
export function ShellLayout({ session, screens }: ShellLayoutProps) {
  const reference = useRef<HTMLDivElement>(null);
  const narrow = useNarrowWidth(reference);
  const [collapsed, setCollapsed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const navigationId = useId();
  // Another tenant took over: the screen starts over (the sidebar and the focus on the selector stay).
  const generation = useSessionGeneration();
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
            <SidebarItem key={screen.id} item={screen} compact={compact} />
          ))}
          {sections.length > 0 ? (
            <div className="fc-sidebar-sections">
              {sections.map((group) => (
                <SidebarItem key={group.section} item={group} compact={compact} />
              ))}
            </div>
          ) : null}
        </nav>

        <div className="fc-sidebar-footer">
          <UserMenu user={session.user} onFailure={(error) => setNotice(signOutErrorMessage(error))} />
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
          <Outlet key={generation} />
        </div>
      </main>
    </div>
  );
}

/** A sidebar item: a screen, or a whole section, active on any of its screens. */
function SidebarItem({ item, compact }: { item: { label: string; path: string; icon?: ReactNode }; compact: boolean }) {
  const link = (
    <NavLink to={`/${item.path}`} className="fc-sidebar-item">
      <span className="fc-sidebar-item-icon" aria-hidden="true">
        {item.icon}
      </span>
      <span className="fc-sidebar-item-label">{item.label}</span>
    </NavLink>
  );
  // With icons only, the name shows in the tooltip (estilos.md §15); the label stays on the link for the screen reader.
  return compact ? (
    <Tooltip content={item.label} side="right">
      {link}
    </Tooltip>
  ) : (
    link
  );
}
