import * as RadixDialog from '@radix-ui/react-dialog';
import { useRef, type ReactElement, type ReactNode, type RefObject } from 'react';
import { Button } from '../form';
import { useFluxoPortal } from '../root';
import { textClasses } from '../typography';
import { CloseIcon } from './icons';
import './dialog.css';

// Elements Tab reaches (close enough to decide the initial focus).
const focusables =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface DialogProps {
  /** Title (heading-16), a noun: "Ajustar valor". It is the dialog's accessible name. */
  title: ReactNode;
  /** Text below the title, linked by `aria-describedby`. */
  description?: ReactNode;
  /** Content (fields, text). */
  children?: ReactNode;
  /**
   * Footer with the actions, aligned right: the main one last ("Ajustar valor"; a dangerous action in red).
   * To close through a button, wrap it in `DialogClose`.
   */
  actions?: ReactNode;
  /** Aberto (controlado). */
  open?: boolean;
  /** Open at first (uncontrolled). */
  initialOpen?: boolean;
  /** Called on open and on close (Esc, click outside, "Fechar" or `DialogClose`). */
  onOpenChange?: (open: boolean) => void;
  /** Element that opens the dialog (a `Button`). Gets the focus back on close. */
  trigger?: ReactElement;
  /**
   * Who gets focus on close: a ref to the element or a function that returns it (called only on close, to
   * find an element that did not exist yet). Serves the dialogs opened from a `Menu` item, whose trigger goes away
   * when the menu closes. Without an element (or without the prop), the Radix behavior applies: the trigger.
   */
  focusOnClose?: RefObject<HTMLElement | null> | (() => HTMLElement | null | undefined);
  /** Extra classes of the panel. */
  className?: string;
}

/**
 * Modal dialog (Radix Dialog; estilos.md §7.7 and §4): 12px radius, heading-16 title and modal shadow.
 * The portal sits in the module root container, never in `body` (ADR 0011); focus is trapped inside it, Esc and the
 * "Fechar" button close, and focus goes back to the trigger. Opens with focus on the first focusable element of the content or
 * actions; without any, on the panel itself.
 */
export function Dialog({
  title,
  description,
  children,
  actions,
  open,
  initialOpen,
  onOpenChange,
  trigger,
  focusOnClose,
  className,
}: DialogProps) {
  const portal = useFluxoPortal();
  const panel = useRef<HTMLDivElement>(null);
  // Without a description, Radix asks for aria-describedby explicitly undefined.
  const noDescription = description ? {} : { 'aria-describedby': undefined };

  return (
    <RadixDialog.Root open={open} defaultOpen={initialOpen} onOpenChange={onOpenChange}>
      {trigger ? <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger> : null}
      {portal && (
        <RadixDialog.Portal container={portal}>
          <RadixDialog.Overlay className="fc-dialog-backdrop" />
          <RadixDialog.Content
            ref={panel}
            className={['fc-dialog', className].filter(Boolean).join(' ')}
            onOpenAutoFocus={(event) => {
              // Radix focuses the first focusable element. If it is only "Fechar", its tooltip would open on focus and the first Esc
              // would close the tooltip, not the dialog: in that case focus goes to the panel itself.
              const first = panel.current?.querySelector<HTMLElement>(focusables);
              if (panel.current && (!first || first.classList.contains('fc-dialog-close'))) {
                event.preventDefault();
                panel.current.focus();
              }
            }}
            onCloseAutoFocus={(event) => {
              const target = typeof focusOnClose === 'function' ? focusOnClose() : focusOnClose?.current;
              if (!target) return;
              event.preventDefault();
              target.focus();
            }}
            {...noDescription}
          >
            <div className="fc-dialog-body">
              <div className="fc-dialog-header">
                <RadixDialog.Title className={`fc-dialog-title ${textClasses({ variant: 'heading-16' })}`}>{title}</RadixDialog.Title>
                {description ? (
                  <RadixDialog.Description className={`fc-dialog-description ${textClasses({ variant: 'copy-14', emphasis: 'secondary' })}`}>
                    {description}
                  </RadixDialog.Description>
                ) : null}
              </div>
              {children}
            </div>
            {actions ? <div className="fc-dialog-actions">{actions}</div> : null}
            {/* Last in the DOM (in the corner, by CSS): the initial focus goes to the content, not to "Fechar". */}
            <RadixDialog.Close asChild>
              <Button iconOnly variant="ghost" size="small" label="Fechar" icon={<CloseIcon />} className="fc-dialog-close" />
            </RadixDialog.Close>
          </RadixDialog.Content>
        </RadixDialog.Portal>
      )}
    </RadixDialog.Root>
  );
}

export interface DialogCloseProps {
  /** A `Button` ("Cancelar"). The click closes the dialog after calling its `onClick`. */
  children: ReactElement;
}

/** Makes the child button close the dialog it is in. */
export function DialogClose({ children }: DialogCloseProps) {
  return <RadixDialog.Close asChild>{children}</RadixDialog.Close>;
}
