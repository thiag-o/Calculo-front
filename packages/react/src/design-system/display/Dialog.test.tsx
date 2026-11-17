import '@testing-library/jest-dom/vitest';
import '../form/jsdom.test-support';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button, TextField } from '../form';
import { FluxoRoot } from '../root';
import { Dialog, DialogClose, type DialogProps } from '.';

afterEach(cleanup);

function AdjustDialog({ onAdjust = () => {} }: { onAdjust?: () => void }) {
  return (
    <FluxoRoot>
      <Button>Antes</Button>
      <Dialog
        title="Ajustar valor"
        description="O saldo muda na hora e o ajuste fica no extrato."
        trigger={<Button variant="primary">Ajustar valor</Button>}
        actions={
          <>
            <DialogClose>
              <Button>Cancelar</Button>
            </DialogClose>
            <Button variant="danger" onClick={onAdjust}>
              Ajustar valor
            </Button>
          </>
        }
      >
        <TextField label="Motivo" />
      </Dialog>
    </FluxoRoot>
  );
}

async function open() {
  const user = userEvent.setup();
  render(<AdjustDialog />);
  await user.click(screen.getByRole('button', { name: 'Ajustar valor' }));
  const dialog = await screen.findByRole('dialog');
  return { user, dialog };
}

describe('Dialogo', () => {
  it('fica fechado até o gatilho ser usado', () => {
    render(<AdjustDialog />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('abre como diálogo modal, com o título como nome e a descrição', async () => {
    const { dialog } = await open();
    expect(dialog).toHaveAccessibleName('Ajustar valor');
    expect(dialog).toHaveAccessibleDescription('O saldo muda na hora e o ajuste fica no extrato.');
    expect(screen.getByRole('heading', { name: 'Ajustar valor' })).toHaveClass('fc-heading-16');
  });

  it('o portal fica dentro da raiz do módulo, não no body', async () => {
    const user = userEvent.setup();
    render(<AdjustDialog />);
    const trigger = screen.getByRole('button', { name: 'Ajustar valor' });
    await user.click(trigger);
    const dialog = await screen.findByRole('dialog');
    expect(dialog.closest('.fc-portals')).not.toBeNull();
    expect(dialog.closest('.fc-root')).not.toBeNull();
    expect(dialog.parentElement).not.toBe(document.body);
    const background = document.querySelector('.fc-dialog-backdrop');
    expect(background?.closest('.fc-portals')).not.toBeNull();
    // The same root as the trigger (inherited theme and font), and no new child in the body.
    expect(dialog.closest('.fc-root')).toBe(trigger.closest('.fc-root'));
    expect(Array.from(document.body.children).filter((child) => child.contains(dialog))).toHaveLength(1);
    expect(Array.from(document.body.children).find((child) => child.contains(dialog))).toContainElement(trigger);
  });

  it('abre com o foco no primeiro campo', async () => {
    await open();
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Motivo' })).toHaveFocus());
  });

  it('prende o foco: Tab e Shift+Tab circulam só dentro do diálogo', async () => {
    const { user, dialog } = await open();
    const field = screen.getByRole('textbox', { name: 'Motivo' });
    await waitFor(() => expect(field).toHaveFocus());
    await user.tab();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    await user.tab();
    expect(screen.getAllByRole('button', { name: 'Ajustar valor' }).at(-1)).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveFocus();
    await user.tab();
    expect(field).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveFocus();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it('o resto do módulo fica oculto para o leitor de tela enquanto está aberto', async () => {
    await open();
    expect(screen.queryByRole('button', { name: 'Antes' })).toBeNull();
    const before = screen.getByText('Antes').closest('button');
    expect(before?.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('Esc fecha e devolve o foco ao gatilho', async () => {
    const { user } = await open();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('button', { name: 'Ajustar valor' })).toHaveFocus();
  });

  it('"Fechar" e DialogClose fecham', async () => {
    const { user } = await open();
    await user.click(screen.getByRole('button', { name: 'Fechar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await user.click(screen.getByRole('button', { name: 'Ajustar valor' }));
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('a ação do rodapé roda sem fechar sozinha', async () => {
    const onAdjust = vi.fn();
    const user = userEvent.setup();
    render(<AdjustDialog onAdjust={onAdjust} />);
    await user.click(screen.getByRole('button', { name: 'Ajustar valor' }));
    const buttons = await screen.findAllByRole('button', { name: 'Ajustar valor' });
    await user.click(buttons.at(-1) as HTMLElement);
    expect(onAdjust).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('controlado: abre e fecha pelo estado de quem usa', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    function Controlled() {
      const [open, setOpen] = useState(false);
      return (
        <FluxoRoot>
          <Button onClick={() => setOpen(true)}>Excluir conexão</Button>
          <Dialog
            title="Excluir conexão"
            open={open}
            onOpenChange={(value) => {
              onChange(value);
              setOpen(value);
            }}
          >
            <p>A conexão some de todos os workflows.</p>
          </Dialog>
        </FluxoRoot>
      );
    }
    render(<Controlled />);
    await user.click(screen.getByRole('button', { name: 'Excluir conexão' }));
    const dialog = await screen.findByRole('dialog');
    // Without a description, the dialog does not point to a missing description.
    expect(dialog).not.toHaveAttribute('aria-describedby');
    // Without fields or actions, focus goes to the dialog itself, not to "Fechar" (whose tooltip would open on focus).
    await waitFor(() => expect(dialog).toHaveFocus());
    expect(screen.queryByRole('tooltip')).toBeNull();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveFocus();
    // A single Esc closes: the first one would close the "Fechar" tooltip; focus goes back to the dialog first.
    dialog.focus();
    await user.keyboard('{Escape}');
    expect(onChange).toHaveBeenLastCalledWith(false);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('initialOpen abre sem gatilho', async () => {
    render(
      <FluxoRoot>
        <Dialog title="Sessão expirada" initialOpen>
          <p>Entre de novo para continuar.</p>
        </Dialog>
      </FluxoRoot>,
    );
    expect(await screen.findByRole('dialog', { name: 'Sessão expirada' })).toBeInTheDocument();
  });
});

// Opens from a button that is not a Radix trigger (like a Menu item) and says where focus goes back to.
function DialogWithGivenFocus({ withFunction = false }: { withFunction?: boolean }) {
  const [open, setOpen] = useState(false);
  const destination = useRef<HTMLButtonElement>(null);
  const focus: DialogProps['focusOnClose'] = withFunction ? () => destination.current : destination;
  return (
    <FluxoRoot>
      <Button onClick={() => setOpen(true)}>Abrir de fora</Button>
      <Button ref={destination}>Destino</Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Ajustar valor"
        focusOnClose={focus}
        actions={
          <DialogClose>
            <Button>Cancelar</Button>
          </DialogClose>
        }
      >
        <TextField label="Motivo" />
      </Dialog>
    </FluxoRoot>
  );
}

describe('Dialog com focusOnClose', () => {
  const shapes = [
    ['referência', false],
    ['função', true],
  ] as const;
  const ways = [
    ['Esc', async (user: ReturnType<typeof userEvent.setup>) => user.keyboard('{Escape}')],
    ['o botão Fechar', async (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: 'Fechar' }))],
    ['Cancelar', async (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: 'Cancelar' }))],
  ] as const;

  for (const [shape, withFunction] of shapes) {
    for (const [way, close] of ways) {
      it(`devolve o foco ao elemento informado (${shape}) ao fechar por ${way}`, async () => {
        const user = userEvent.setup();
        render(<DialogWithGivenFocus withFunction={withFunction} />);
        await user.click(screen.getByRole('button', { name: 'Abrir de fora' }));
        await screen.findByRole('dialog');
        await close(user);
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        await waitFor(() => expect(screen.getByRole('button', { name: 'Destino' })).toHaveFocus());
      });
    }
  }
});
