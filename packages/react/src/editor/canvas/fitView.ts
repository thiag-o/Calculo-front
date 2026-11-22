import { getViewportForBounds, type Rect, type Viewport } from '@xyflow/react';

/** Lowest zoom of the navigation (wheel, pinch, controls). */
export const MIN_ZOOM = 0.25;

/**
 * Lowest zoom the fit may use. A wide graph (a batch source plus several groups) in a narrow area needs well under
 * `MIN_ZOOM` to show whole. The fit sets the viewport directly, so it is not held by the navigation limit.
 */
export const FIT_MIN_ZOOM = 0.05;

/** How "Ajustar à tela" (and the first view) fits the blocks. */
export const FIT_VIEW = { padding: '10%' as const, minZoom: FIT_MIN_ZOOM, maxZoom: 1 };

/** The viewport that shows `bounds` whole in an area of the given size, with the zoom floor of the fit. */
export function fitViewport(bounds: Rect, area: { width: number; height: number }): Viewport {
  return getViewportForBounds(bounds, area.width, area.height, FIT_VIEW.minZoom, FIT_VIEW.maxZoom, FIT_VIEW.padding);
}
