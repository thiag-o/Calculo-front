import { Outlet, useLocation, useNavigate } from 'react-router';
import { Tabs } from '../../design-system';
import { useSessionGeneration } from '../../session';
import { NotificationBellSlot, hasNotificationBell } from '../NotificationBellSlot';
import { groupBySection, type ScreenDefinition } from '../screens';
import './embedded.css';

export interface EmbeddedLayoutProps {
  /** Only the screens the user can see. */
  screens: readonly ScreenDefinition[];
}

/**
 * Embedded layout (design.md §15, estilos.md §9 and §15): no sidebar and no top bar of its own, only the internal tabs
 * and the content. The width is whatever the host app gives; the theme comes from the --fc-* variables.
 * The tabs (design system `Tabs`) are the shell sidebar items: each loose screen is a tab, and each section (e.g. Admin)
 * is a single tab, which opens its first allowed screen and stays open on any screen of the section. A section without
 * allowed screens has no tab. Choosing a tab navigates to its route; the open screen is the tab panel.
 * The module is a named region, not a `main`: the host app page already has its own.
 */
export function EmbeddedLayout({ screens }: EmbeddedLayoutProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  // Another person's token took over: the screen starts over, without the previous one's local state.
  const generation = useSessionGeneration();
  const { unsectioned, sections } = groupBySection(screens);
  const tabs = [
    ...unsectioned.map((screen) => ({ value: screen.id, label: screen.label, path: screen.path })),
    ...sections.map((group) => ({ value: `section-${group.section}`, label: group.label, path: group.path })),
  ];
  // The open tab is the one whose route contains the current address (a section tab stays open on any of its screens).
  const open = tabs.find((tab) => pathname === `/${tab.path}` || pathname.startsWith(`/${tab.path}/`));
  const withBell = hasNotificationBell(screens);

  return (
    <section className="fc-embedded" aria-label="Fluxo de Cálculo">
      <Tabs
        label="Telas do Fluxo de Cálculo"
        items={tabs}
        value={open?.value}
        onValueChange={(value) => {
          const tab = tabs.find((candidate) => candidate.value === value);
          if (tab) void navigate(`/${tab.path}`);
        }}
        className="fc-embedded-tabs"
        listClassName={withBell ? 'fc-embedded-tabs-list fc-embedded-tabs-list-with-bell' : 'fc-embedded-tabs-list'}
        panelClassName="fc-module-content fc-embedded-panel"
      >
        <div className="fc-module-page">
          <Outlet key={generation} />
        </div>
      </Tabs>
      {/* The bell (E7-27) at the end of the tab row, over the room the list leaves for it. */}
      {withBell ? (
        <div className="fc-embedded-bell">
          <div className="fc-embedded-bell-slot">
            <NotificationBellSlot screens={screens} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
