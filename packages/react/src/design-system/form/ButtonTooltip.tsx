import type { ReactElement, ReactNode } from 'react';
import { Tooltip } from '../display/Tooltip';

interface ButtonTooltipProps {
  /** The button (a <button> element). Gets the focus and pointer events that open the tooltip. */
  children: ReactElement;
  content: ReactNode;
}

/**
 * Button tooltip: reuses `Tooltip` (focus, hover, Esc, portal inside the root), only stacks name and reason.
 * The tooltip text does not enter aria-describedby through Radix: the Button already describes the reason by itself,
 * and the description must not depend on the tooltip being open.
 */
export function ButtonTooltip({ children, content }: ButtonTooltipProps) {
  return <Tooltip content={<span className="fc-button-tooltip-content">{content}</span>}>{children}</Tooltip>;
}
