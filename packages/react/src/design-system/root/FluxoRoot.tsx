import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import { useState, type ReactNode } from 'react';
import '../tokens/tokens.css';
import '../typography/typography.css';
import { PortalContext } from './portal';
import './root.css';

/** Module theme. `system` follows the operating system's `prefers-color-scheme`. */
export type FluxoTheme = 'light' | 'dark' | 'system';

const themeAttribute: Record<FluxoTheme, 'light' | 'dark' | undefined> = {
  light: 'light',
  dark: 'dark',
  system: undefined,
};

export interface FluxoRootProps {
  /** Default: `system`. */
  theme?: FluxoTheme;
  /** Extra classes from the host app or the layout, added to `fc-root`. */
  className?: string;
  children?: ReactNode;
}

// Geist and Geist Mono bundled locally (answer G7: local fonts, no CDN). They are external imports in the package
// build (vite.config.ts): the host app bundler packs the .woff2 files and the browser only downloads the subsets used
// (unicode-range). They live here, in a used module, because the package.json `sideEffects` (CSS only) would make the build
// drop a module that only had these imports. @font-face is not a selector: it does not style the host app.

/**
 * Module root: scope of the --fc-* tokens and the typography, theme through `data-theme`
 * and container of the (Radix) portals inside the module itself, never in `body` (ADR 0002).
 */
export function FluxoRoot({ theme = 'system', className, children }: FluxoRootProps) {
  const [portal, setPortal] = useState<HTMLDivElement | null>(null);
  const classes = className ? `fc-root ${className}` : 'fc-root';

  return (
    <div className={classes} data-theme={themeAttribute[theme]}>
      <PortalContext.Provider value={portal}>
        {children}
        <div ref={setPortal} className="fc-portals" data-fc-portals="" />
      </PortalContext.Provider>
    </div>
  );
}
