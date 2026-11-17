import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useId, type ReactElement, type ReactNode } from 'react';
import { useFluxoPortal } from '../root';
import './menu.css';

export interface MenuAction {
  type?: 'action';
  /** Verb + object, with the same label as the rest of the product (estilos.md §13): "Baixar CSV". */
  label: string;
  onSelect: () => void;
  /** 16px Lucide icon on the left. */
  icon?: ReactNode;
  /** Destructive action ("Excluir conexão"): red text. */
  danger?: boolean;
  /**
   * Disables the action saying why (estilos.md §14), as in `Button` (ADR 0012). The item stays reachable
   * by the arrows, with `aria-disabled`, and the reason shows below the label and in `aria-describedby`.
   */
  disabledReason?: string;
}

export interface MenuSeparator {
  type: 'separator';
}

export type MenuItem = MenuAction | MenuSeparator;

export interface MenuProps {
  /** Element that opens the menu, usually `<Button iconOnly label="Mais ações" icon={…} />`. */
  trigger: ReactElement;
  items: readonly MenuItem[];
  /** Menu alignment with the trigger. Default: `end` ("…" menus at the end of the rows). */
  align?: 'start' | 'end';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Dropdown menu (Radix DropdownMenu; estilos.md §4 and §7.1): 12px radius, menu shadow, 32px items with 6px radius.
 * Keyboard: Enter, Space and arrow down open; arrows, Home, End and typing navigate; Enter picks;
 * Esc closes and gives focus back to the trigger. The portal sits in the module root container (ADR 0011).
 */
export function Menu({ trigger, items, align = 'end', open, onOpenChange }: MenuProps) {
  const portal = useFluxoPortal();
  return (
    <DropdownMenu.Root open={open} onOpenChange={onOpenChange}>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      {portal && (
        <DropdownMenu.Portal container={portal}>
          <DropdownMenu.Content
            className="fc-menu"
            align={align === 'end' ? 'end' : 'start'}
            sideOffset={4}
            collisionPadding={8}
          >
            {items.map((item, index) =>
              item.type === 'separator' ? (
                <DropdownMenu.Separator key={`separador-${index}`} className="fc-menu-separator" />
              ) : (
                <ActionItem key={`${item.label}-${index}`} item={item} />
              ),
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      )}
    </DropdownMenu.Root>
  );
}

function ActionItem({ item }: { item: MenuAction }) {
  const id = useId();
  const labelId = `${id}-rotulo`;
  const reasonId = `${id}-motivo`;
  const disabled = Boolean(item.disabledReason);
  const classes = ['fc-menu-item', item.danger ? 'fc-menu-item-danger' : null, disabled ? 'fc-menu-item-disabled' : null]
    .filter(Boolean)
    .join(' ');

  return (
    <DropdownMenu.Item
      className={classes}
      aria-labelledby={labelId}
      aria-describedby={disabled ? reasonId : undefined}
      aria-disabled={disabled || undefined}
      onSelect={(event) => {
        // Disabled with a reason: does nothing and keeps the menu open, with the reason in view.
        if (disabled) {
          event.preventDefault();
          return;
        }
        item.onSelect();
      }}
    >
      {item.icon ? (
        <span className="fc-menu-item-icon" aria-hidden="true">
          {item.icon}
        </span>
      ) : null}
      <span className="fc-menu-item-text">
        <span id={labelId} className="fc-menu-item-label">
          {item.label}
        </span>
        {disabled ? (
          <span id={reasonId} className="fc-menu-item-reason">
            {item.disabledReason}
          </span>
        ) : null}
      </span>
    </DropdownMenu.Item>
  );
}
