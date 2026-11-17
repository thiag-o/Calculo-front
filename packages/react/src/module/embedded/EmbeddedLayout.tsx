import { NavLink, Outlet } from 'react-router';
import { groupBySection, type ScreenDefinition } from '../screens';
import './embedded.css';

export interface EmbeddedLayoutProps {
  /** Only the screens the user can see. */
  screens: readonly ScreenDefinition[];
}

/**
 * Embedded layout (design.md §15, estilos.md §9 and §15): no sidebar and no top bar of its own, only the internal tabs
 * and the content. The width is whatever the host app gives; the theme comes from the --fc-* variables.
 * The tabs are the shell sidebar items: each loose screen is a tab, and each section (e.g. Admin) is a
 * single tab, which opens its first allowed screen and stays active on any screen of the section. A section without allowed
 * screens has no tab.
 * The content is a named region, not a `main`: the host app page already has its own.
 */
export function EmbeddedLayout({ screens }: EmbeddedLayoutProps) {
  const { unsectioned, sections } = groupBySection(screens);
  const tabs = [
    ...unsectioned.map((screen) => ({ id: screen.id, label: screen.label, path: screen.path })),
    ...sections.map((group) => ({ id: `section-${group.section}`, label: group.label, path: group.path })),
  ];
  return (
    <div className="fc-embedded">
      <div className="fc-tabs">
        <nav className="fc-tabs-list" aria-label="Telas do Fluxo de Cálculo">
          {tabs.map((tab) => (
            <NavLink key={tab.id} to={`/${tab.path}`} className="fc-tab">
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <section className="fc-module-content" aria-label="Fluxo de Cálculo">
        <div className="fc-module-page">
          <Outlet />
        </div>
      </section>
    </div>
  );
}
