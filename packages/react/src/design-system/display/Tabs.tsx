import * as RadixTabs from '@radix-ui/react-tabs';
import { useRef, useState, type ReactNode } from 'react';
import './tabs.css';

export interface TabItem<V extends string = string> {
  value: V;
  /** Tab name: a noun, without a final period (estilos.md §10). */
  label: string;
}

/**
 * `default`: 14px, the module's own tabs (embedded mode, Superdesign "D · …" screens).
 * `small`: 13px, tabs inside a screen or a panel (estilos.md §7.7).
 */
export type TabsSize = 'default' | 'small';

export interface TabsProps<V extends string = string> {
  /** Accessible name of the tab list ("Administração"). */
  label: string;
  /**
   * The tabs the person can see, in order. Whoever uses the component filters them (e.g. by permission): a tab that is not in
   * the list does not exist. Without any tab, nothing is rendered.
   */
  items: readonly TabItem<V>[];
  /**
   * Open tab, when whoever uses the component controls the choice (e.g. bound to a route). A value outside `items` opens the first
   * tab. Without it, the component keeps the choice by itself, starting on `defaultValue` or on the first tab.
   */
  value?: V;
  defaultValue?: V;
  /** Called once when the person picks another tab (click or keyboard). Picking the open tab notifies nobody. */
  onValueChange?: (value: V) => void;
  /** Default: `default`. */
  size?: TabsSize;
  /** Extra classes of the root, of the list (e.g. width of the layout) and of the panel. */
  className?: string;
  listClassName?: string;
  panelClassName?: string;
  /** Content of the open tab, or a function that receives it. */
  children?: ReactNode | ((value: V) => ReactNode);
}

/**
 * Tabs (Radix Tabs; estilos.md §5 and §7.7): tab list over a 1px divider; the open tab with 500 text and a 2px
 * gray-1000 underline; tab switch in 150ms.
 * Keyboard (WAI-ARIA, automatic activation): Tab enters on the open tab, arrows move and choose (wrapping around),
 * Home and End go to the ends; the next Tab goes to the panel, which takes focus because it may start without
 * a focusable element.
 */
export function Tabs<V extends string = string>({
  label,
  items,
  value,
  defaultValue,
  onValueChange,
  size = 'default',
  className,
  listClassName,
  panelClassName,
  children,
}: TabsProps<V>) {
  const [localChoice, setLocalChoice] = useState<V | undefined>(defaultValue);
  // Radix notifies twice on a click while the choice is controlled and has not changed yet (mouse down and focus):
  // only the first notice of the same value, in the same event, goes on.
  const notified = useRef<V | null>(null);

  const requested = value ?? localChoice;
  const open = items.find((item) => item.value === requested) ?? items[0];
  if (!open) return null;

  function choose(next: string) {
    const item = items.find((candidate) => candidate.value === next);
    if (!item || item.value === open?.value || notified.current === item.value) return;
    notified.current = item.value;
    queueMicrotask(() => {
      notified.current = null;
    });
    if (value === undefined) setLocalChoice(item.value);
    onValueChange?.(item.value);
  }

  const classes = ['fc-tabs', size === 'small' ? 'fc-tabs-small' : null, className].filter(Boolean).join(' ');
  return (
    <RadixTabs.Root className={classes} value={open.value} onValueChange={choose}>
      <div className="fc-tabs-bar">
        <RadixTabs.List className={['fc-tabs-list', listClassName].filter(Boolean).join(' ')} aria-label={label}>
          {items.map((item) => (
            <RadixTabs.Trigger key={item.value} value={item.value} className="fc-tab">
              {item.label}
            </RadixTabs.Trigger>
          ))}
        </RadixTabs.List>
      </div>
      <RadixTabs.Content value={open.value} className={['fc-tabs-panel', panelClassName].filter(Boolean).join(' ')}>
        {typeof children === 'function' ? children(open.value) : children}
      </RadixTabs.Content>
    </RadixTabs.Root>
  );
}
