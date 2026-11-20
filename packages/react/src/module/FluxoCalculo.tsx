import { Navigate, Route, Routes } from 'react-router';
import type { FluxoTheme } from '../design-system';
import { useSession, type Session } from '../session';
import { ShellLayout } from './shell/ShellLayout';
import { ModuleLoading, ModuleError, NoScreens } from './ModuleStates';
import { EmbeddedLayout } from './embedded/EmbeddedLayout';
import { ModuleProvider } from './ModuleProvider';
import { ModuleRouter, type FluxoNavigation } from './router/ModuleRouter';
import { groupBySection, initialScreen, SCREENS, allowedScreens, type ScreenDefinition, type FluxoScreen } from './screens';

/**
 * Events the module reports to the host app (design.md §3: execution finished, version published…), for information only.
 * Epic 1 emits none yet; each epic adds its own to this union.
 */
export type FluxoEvent = never;

export interface FluxoCalculoProps {
  /** API address, without `/v1`. */
  apiUrl: string;
  /**
   * Embed token, requested by the host app backend. With it, the module calls the API with `Authorization:
   * Bearer` and uses the embedded layout (tabs, no sidebar). Without it, it uses the session cookie (shell app).
   */
  token?: string;
  /** Screen the module opens on. Default: `home`. In `url` mode, the current URL takes precedence. */
  screen?: FluxoScreen;
  /** Default: `system`. */
  theme?: FluxoTheme;
  /** `url` (shell) or `memory`, which does not touch the host app URL. Default: `memory` with `token`, `url` without. */
  navigation?: FluxoNavigation;
  /** Notifications to the host app (none yet in epic 1). */
  onEvent?: (event: FluxoEvent) => void;
  /**
   * Called when there is no session anymore: the API answered `401 no_session` (expired, revoked, token expired) or
   * the person signed out. In the shell, it is time to go back to sign-in; embedded, to renew the token.
   */
  onSessionExpired?: () => void;
}

/**
 * The whole Fluxo de Cálculo (design.md §3 and §15): module root (tokens and theme), API client, own QueryClient
 * and the router (`url` or `memory`). In the shell, sidebar with the tenant selector; embedded, tabs.
 */
export function FluxoCalculo(props: FluxoCalculoProps) {
  return <FluxoModule {...props} screens={SCREENS} />;
}

export interface FluxoModuleProps extends Omit<FluxoCalculoProps, 'screen'> {
  /** The module screens, in menu order. `<FluxoCalculo>` passes the product ones; tests pass others. */
  screens: readonly ScreenDefinition[];
  /** The `id` of the initial screen, among the `screens`, or of a section (opens its first screen). */
  screen?: string;
}

/**
 * The module with the given screens: the internal provider (root, API, cache and session end) and, inside it, the
 * router and the mode layout (shell or embedded).
 */
export function FluxoModule({ apiUrl, token, screen, theme, navigation, onSessionExpired, screens }: FluxoModuleProps) {
  const embedded = token !== undefined;
  const navigationMode: FluxoNavigation = navigation ?? (embedded ? 'memory' : 'url');
  return (
    <ModuleProvider apiUrl={apiUrl} token={token} theme={theme} onSessionExpired={onSessionExpired}>
      <ModuleContent embedded={embedded} navigation={navigationMode} screen={screen} screens={screens} />
    </ModuleProvider>
  );
}

interface ModuleContentProps {
  embedded: boolean;
  navigation: FluxoNavigation;
  screen: string | undefined;
  screens: readonly ScreenDefinition[];
}

/** Waits for the session; with it, mounts the router and the mode layout (shell or embedded). */
function ModuleContent({ embedded, navigation, screen, screens }: ModuleContentProps) {
  const session = useSession();

  // With a session in the cache, an error on a new fetch does not take the module down; without it, shows the fetch state.
  if (!session.data) {
    if (session.isError) {
      return <ModuleError error={session.error} retrying={session.isFetching} onRetry={() => void session.refetch()} />;
    }
    return <ModuleLoading />;
  }

  const visible = allowedScreens(screens, session.hasPermission);
  const initial = initialScreen(visible, screen);
  if (!initial) return <NoScreens />;

  return (
    <ModuleRouter navigation={navigation} initialPath={`/${initial.path}`}>
      <ModuleRoutes embedded={embedded} session={session.data} screens={visible} initial={initial} />
    </ModuleRouter>
  );
}

interface ModuleRoutesProps {
  embedded: boolean;
  session: Session;
  screens: readonly ScreenDefinition[];
  initial: ScreenDefinition;
}

/**
 * One route per allowed screen, and one per section, which opens its first allowed screen. A route without permission or
 * unknown (including after switching tenant) goes back to the initial screen.
 */
function ModuleRoutes({ embedded, session, screens, initial }: ModuleRoutesProps) {
  const toInitial = <Navigate to={`/${initial.path}`} replace />;
  const { sections } = groupBySection(screens);
  return (
    <Routes>
      <Route element={embedded ? <EmbeddedLayout screens={screens} /> : <ShellLayout session={session} screens={screens} />}>
        <Route index element={toInitial} />
        {screens.map((definition) => (
          <Route
            key={definition.id}
            path={definition.nested ? `${definition.path}/*` : definition.path}
            element={definition.content}
          />
        ))}
        {sections.map((group) => (
          <Route
            key={`section-${group.section}`}
            path={group.path}
            element={<Navigate to={`/${group.screens[0]?.path ?? initial.path}`} replace />}
          />
        ))}
        <Route path="*" element={toInitial} />
      </Route>
    </Routes>
  );
}
