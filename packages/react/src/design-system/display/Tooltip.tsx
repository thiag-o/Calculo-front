import * as RadixTooltip from '@radix-ui/react-tooltip';
import type { ReactElement, ReactNode } from 'react';
import { useFluxoPortal } from '../root';
import './tooltip.css';

export type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  /** Short tooltip text ("Abrir editor"). Do not put essential information in it that is not somewhere else. */
  content: ReactNode;
  /**
   * The element that shows the tooltip. Must be focusable and accept `ref` (a button, a link). Gets the focus and
   * pointer events, and the tooltip's `aria-describedby` while it is open.
   */
  children: ReactElement;
  /** Default: `top`. */
  side?: TooltipSide;
}

/**
 * Tooltip (estilos.md §7.7): gray-1000 background, background-100 text, 12px, 6px radius; same look as the
 * `Button` tooltip. Opens on focus and on hover (300 ms), closes with Esc, on click and on leave. The portal sits in the module
 * root container (ADR 0011).
 * For the name of an icon-only button, use `<Button iconOnly label>`, which already shows the tooltip.
 */
export function Tooltip({ content, children, side = 'top' }: TooltipProps) {
  const portal = useFluxoPortal();
  return (
    <RadixTooltip.Provider delayDuration={300}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        {portal && (
          <RadixTooltip.Portal container={portal}>
            <RadixTooltip.Content className="fc-tooltip" side={side} sideOffset={6} collisionPadding={8}>
              {content}
            </RadixTooltip.Content>
          </RadixTooltip.Portal>
        )}
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
