import type { ReactNode } from 'react';
import {
  BrowserRouter,
  MemoryRouter,
  UNSAFE_DataRouterContext,
  UNSAFE_DataRouterDataContext,
  UNSAFE_DataRouterNavigationContext,
  UNSAFE_DataRouterStateContext,
  UNSAFE_FetchersContext,
  UNSAFE_FrameworkContext,
  UNSAFE_LocationContext,
  UNSAFE_NavigationContext,
  UNSAFE_RouteContext,
  UNSAFE_ViewTransitionContext,
} from 'react-router';

/**
 * - `url` (shell app): internal routes bound to the browser URL, with direct links and the back button;
 * - `memory` (default when embedded): in-memory routes; the host app URL and history do not change.
 */
export type FluxoNavigation = 'url' | 'memory';

const EMPTY_ROUTE = { outlet: null, matches: [], isDataRoute: false };
const NO_TRANSITION = { isTransitioning: false } as const;

/**
 * Separates the module router from the host app router (ADR 0002 and 0006).
 *
 * `react-router` is an external dependency of the package: if the host app uses the same copy, its contexts reach
 * the module. Without this, the module `<Router>` refuses to mount inside another one, the module routes would resolve
 * below the host app route and `useNavigate` could navigate the host app data router. Here the
 * contexts go back to their default values, as if there were no router above.
 */
function HostAppIsolation({ children }: { children: ReactNode }) {
  return (
    <UNSAFE_FrameworkContext.Provider value={undefined}>
      <UNSAFE_DataRouterContext.Provider value={null}>
        <UNSAFE_DataRouterStateContext.Provider value={null}>
          <UNSAFE_DataRouterDataContext.Provider value={null}>
            <UNSAFE_DataRouterNavigationContext.Provider value={null}>
              <UNSAFE_FetchersContext.Provider value={null}>
                <UNSAFE_ViewTransitionContext.Provider value={NO_TRANSITION}>
                  {/* The types do not accept null, but null is the default value of these two contexts ("outside a router"). */}
                  <UNSAFE_NavigationContext.Provider value={null as never}>
                    <UNSAFE_LocationContext.Provider value={null as never}>
                      <UNSAFE_RouteContext.Provider value={EMPTY_ROUTE}>{children}</UNSAFE_RouteContext.Provider>
                    </UNSAFE_LocationContext.Provider>
                  </UNSAFE_NavigationContext.Provider>
                </UNSAFE_ViewTransitionContext.Provider>
              </UNSAFE_FetchersContext.Provider>
            </UNSAFE_DataRouterNavigationContext.Provider>
          </UNSAFE_DataRouterDataContext.Provider>
        </UNSAFE_DataRouterStateContext.Provider>
      </UNSAFE_DataRouterContext.Provider>
    </UNSAFE_FrameworkContext.Provider>
  );
}

export interface ModuleRouterProps {
  navigation: FluxoNavigation;
  /** Path where `memory` mode starts (the initial screen). In `url` mode, the current URL applies. */
  initialPath: string;
  children: ReactNode;
}

/** The module router, by URL or in memory, isolated from the host app router. */
export function ModuleRouter({ navigation, initialPath, children }: ModuleRouterProps) {
  return (
    <HostAppIsolation>
      {navigation === 'memory' ? (
        <MemoryRouter initialEntries={[initialPath]}>{children}</MemoryRouter>
      ) : (
        <BrowserRouter>{children}</BrowserRouter>
      )}
    </HostAppIsolation>
  );
}
