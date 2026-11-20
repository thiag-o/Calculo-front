// Sub-vertical "layout" of the "editor" vertical (ADR 0003): the editor screen (E4-20) with the 48px bar, the Camadas,
// canvas and Propriedades panels and the collapsible bottom panel. The panels get their content by props (F57 mounts them).
export { EditorScreen, PROBLEMS_TAB } from './EditorScreen';
export type { EditorScreenProps } from './EditorScreen';
export { EditorLayout } from './EditorLayout';
export type { EditorLayoutProps, BottomTab } from './EditorLayout';
export { EditorBar } from './EditorBar';
export type { EditorBarProps } from './EditorBar';
export { usePanelWidths, NARROW_PANELS_UP_TO } from './usePanelWidths';
export type { PanelWidths } from './usePanelWidths';
