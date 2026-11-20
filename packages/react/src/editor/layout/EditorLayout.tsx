import * as RadixTabs from '@radix-ui/react-tabs';
import { forwardRef, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Badge, Button } from '../../design-system';
import { ChevronDownIcon, ChevronUpIcon } from './icons';
import { usePanelWidths } from './usePanelWidths';
import './editor-layout.css';

/** A tab of the bottom panel (Problemas, Calcular…). */
export interface BottomTab {
  value: string;
  /** Tab name, a noun ("Problemas"). */
  label: string;
  /** Red count beside the name (problems). Zero or absent: no count. */
  count?: number;
  content: ReactNode;
}

export interface EditorLayoutProps {
  /** Accessible name of the editor region ("Editor de Pontuação de exemplo"). */
  label: string;
  /** The 48px bar. */
  bar: ReactNode;
  /** Notes between the bar and the panels (conflict, failed save). */
  notices?: ReactNode;
  layers?: ReactNode;
  canvas?: ReactNode;
  properties?: ReactNode;
  bottomTabs: readonly BottomTab[];
  bottomTab: string;
  onBottomTabChange: (value: string) => void;
  bottomCollapsed: boolean;
  onBottomCollapsedChange: (collapsed: boolean) => void;
  /** Keys pressed anywhere inside the editor (Ctrl Z, Ctrl Shift Z). */
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
}

/** The tab trigger of a bottom tab, inside the editor element, for whoever needs to focus it (the bar's problem counter). */
export function findBottomTab(editor: HTMLElement | null, value: string): HTMLElement | null {
  return editor?.querySelector<HTMLElement>(`[role="tab"][data-tab="${value}"]`) ?? null;
}

/**
 * The editor layout (estilos.md §9 and §15; reference screen "D · Editor"): the 48px bar on top; Camadas (260px), the
 * flexible canvas and Propriedades (340px) in the middle, 220px and 300px from 1280px of module width down; and the
 * bottom panel (220px, collapsible to its tab bar) across the whole width. It fills the height of its container. The
 * panels get their content by props: the editor screen mounts them.
 */
export const EditorLayout = forwardRef<HTMLElement, EditorLayoutProps>(function EditorLayout(
  {
    label,
    bar,
    notices,
    layers,
    canvas,
    properties,
    bottomTabs,
    bottomTab,
    onBottomTabChange,
    bottomCollapsed,
    onBottomCollapsedChange,
    onKeyDown,
  },
  ref,
) {
  const measured = useRef<HTMLDivElement>(null);
  const widths = usePanelWidths(measured);
  const open = bottomTabs.find((tab) => tab.value === bottomTab) ?? bottomTabs[0];

  return (
    // tabIndex -1: the editor itself can take the focus (after a note goes away, or a click on an empty area), so Ctrl Z
    // and Ctrl Shift Z keep working there. It declares the shortcuts too, since it is the element that gets the focus.
    <section
      ref={ref}
      className="fc-editor"
      aria-label={label}
      tabIndex={-1}
      aria-keyshortcuts="Control+Z Control+Shift+Z"
      onKeyDown={onKeyDown}
    >
      <div ref={measured} className="fc-editor-frame" data-widths={widths} data-bottom={bottomCollapsed ? 'collapsed' : 'open'}>
        <header className="fc-editor-bar">{bar}</header>
        {notices ? <div className="fc-editor-notices">{notices}</div> : null}
        <div className="fc-editor-middle">
          <aside className="fc-editor-layers" aria-label="Camadas">
            {layers}
          </aside>
          {/* Ctrl Z and Ctrl Shift Z undo and redo the draft (useUndoShortcuts); there are no visible buttons in this epic. */}
          <div className="fc-editor-canvas" role="region" aria-label="Canvas" aria-keyshortcuts="Control+Z Control+Shift+Z">
            {canvas}
          </div>
          <aside className="fc-editor-properties" aria-label="Propriedades">
            {properties}
          </aside>
        </div>
        {open ? (
          <RadixTabs.Root
            className="fc-editor-bottom"
            value={open.value}
            onValueChange={(value) => {
              onBottomTabChange(value);
              if (bottomCollapsed) onBottomCollapsedChange(false);
            }}
          >
            <div className="fc-editor-bottom-bar">
              <RadixTabs.List className="fc-editor-bottom-tabs" aria-label="Painel inferior">
                {bottomTabs.map((tab) => (
                  <RadixTabs.Trigger key={tab.value} data-tab={tab.value} value={tab.value} className="fc-editor-bottom-tab">
                    {tab.label}
                    {tab.count ? ' ' : null}
                    {tab.count ? (
                      <Badge tone="red" className="fc-editor-bottom-count">
                        {tab.count.toLocaleString('pt-BR')}
                      </Badge>
                    ) : null}
                  </RadixTabs.Trigger>
                ))}
              </RadixTabs.List>
              <Button
                variant="ghost"
                size="small"
                iconOnly
                icon={bottomCollapsed ? <ChevronUpIcon size={14} /> : <ChevronDownIcon size={14} />}
                // A fixed name: only aria-expanded says whether the panel is open (a name that flips would be read as
                // another button).
                label="Painel inferior"
                aria-expanded={!bottomCollapsed}
                onClick={() => onBottomCollapsedChange(!bottomCollapsed)}
              />
            </div>
            {bottomCollapsed ? null : (
              <RadixTabs.Content value={open.value} className="fc-editor-bottom-panel">
                {open.content}
              </RadixTabs.Content>
            )}
          </RadixTabs.Root>
        ) : null}
      </div>
    </section>
  );
});
