import '@testing-library/jest-dom/vitest';
import './jsdom.test-support';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FluxoRoot } from '../root';
import { Select, type SelectOption, type SelectProps } from '.';

afterEach(cleanup);

const fonts: SelectOption[] = [
  { value: 'postgres', label: 'PostgreSQL' },
  { value: 'sqlserver', label: 'SQL Server' },
  { value: 'oracle', label: 'Oracle', disabled: true },
  { value: 'excel', label: 'Excel' },
];

function renderScreen(props: Partial<SelectProps> = {}) {
  return render(
    <FluxoRoot>
      <Select label="Tipo de conexão" options={fonts} {...props} />
    </FluxoRoot>,
  );
}

function trigger(): HTMLElement {
  return screen.getByRole('combobox', { name: 'Tipo de conexão' });
}

describe('Selecao', () => {
  it('é um combobox com o rótulo como nome e o texto de espera', () => {
    renderScreen();
    expect(trigger()).toHaveTextContent('Selecione');
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(trigger()).toHaveClass('fc-select-trigger');
  });

  it('abre pelo teclado com a lista dentro da raiz do módulo, não no body', async () => {
    const user = userEvent.setup({ delay: null });
    renderScreen();
    await user.tab();
    const element = trigger();
    expect(element).toHaveFocus();
    await user.keyboard('{Enter}');
    const list = await screen.findByRole('listbox');
    // Open, the list is modal: the rest of the page becomes aria-hidden.
    expect(element).toHaveAttribute('aria-expanded', 'true');
    expect(element).toHaveAttribute('aria-controls', list.id);
    expect(list.closest('.fc-portals')).not.toBeNull();
    expect(list.closest('.fc-root')).not.toBeNull();
    expect(within(list).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'PostgreSQL',
      'SQL Server',
      'Oracle',
      'Excel',
    ]);
  });

  it('as setas navegam, Enter escolhe e o foco volta ao gatilho', async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    renderScreen({ onValueChange: onChange });
    await user.tab();
    await user.keyboard('{ArrowDown}');
    await screen.findByRole('listbox');
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('option', { name: 'SQL Server' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('sqlserver');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(trigger()).toHaveTextContent('SQL Server');
    expect(trigger()).toHaveFocus();
  });

  it('pula a opção desabilitada', async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    renderScreen({ onValueChange: onChange, defaultValue: 'sqlserver' });
    await user.tab();
    await user.keyboard('{Enter}');
    await screen.findByRole('listbox');
    expect(screen.getByRole('option', { name: 'Oracle' })).toHaveAttribute('aria-disabled', 'true');
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('option', { name: 'Excel' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('excel');
  });

  it('Esc fecha sem mudar o valor e devolve o foco', async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    renderScreen({ onValueChange: onChange, defaultValue: 'postgres' });
    await user.tab();
    await user.keyboard(' ');
    await screen.findByRole('listbox');
    await user.keyboard('{ArrowDown}{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    expect(trigger()).toHaveTextContent('PostgreSQL');
    expect(trigger()).toHaveFocus();
  });

  it('escolhe pelo mouse', async () => {
    const user = userEvent.setup({ delay: null });
    renderScreen();
    await user.click(trigger());
    await user.click(await screen.findByRole('option', { name: 'Excel' }));
    expect(trigger()).toHaveTextContent('Excel');
  });

  it('controlada: o valor vem de fora', async () => {
    // Keeps the default pause between keys: {Home}{Enter} only picks the first option when Radix has time to move focus.
    const user = userEvent.setup();
    function Controlled() {
      const [value, setValue] = useState('excel');
      return (
        <FluxoRoot>
          <Select label="Tipo de conexão" options={fonts} value={value} onValueChange={setValue} />
          <p>Escolhida: {value}</p>
        </FluxoRoot>
      );
    }
    render(<Controlled />);
    expect(trigger()).toHaveTextContent('Excel');
    await user.tab();
    await user.keyboard('{Enter}');
    await screen.findByRole('listbox');
    await user.keyboard('{Home}{Enter}');
    expect(screen.getByText('Escolhida: postgres')).toBeInTheDocument();
  });

  it('erro marca aria-invalid; dica e erro descrevem o gatilho', () => {
    renderScreen({ tooltip: 'Fontes que o motor lê', error: 'Escolha o tipo de conexão' });
    expect(trigger()).toHaveAttribute('aria-invalid', 'true');
    expect(trigger()).toHaveAccessibleDescription('Escolha o tipo de conexão Fontes que o motor lê');
  });

  it('desabilitada: fora do Tab e não abre', async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <FluxoRoot>
        <Select label="Tipo de conexão" options={fonts} disabled />
        <button type="button">Depois</button>
      </FluxoRoot>,
    );
    expect(trigger()).toBeDisabled();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Depois' })).toHaveFocus();
    await user.click(trigger());
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('a lista acompanha o campo quando ele se move com a lista aberta', async () => {
    const user = userEvent.setup({ delay: null });
    let top = 100;
    const rect = () => ({ x: 20, y: top, left: 20, top, right: 220, bottom: top + 36, width: 200, height: 36, toJSON: () => ({}) });
    renderScreen();
    vi.spyOn(trigger(), 'getBoundingClientRect').mockImplementation(rect as () => DOMRect);
    await user.click(trigger());
    const list = await screen.findByRole('listbox');
    const wrapper = list.closest<HTMLElement>('[data-radix-popper-content-wrapper]');
    expect(wrapper).not.toBeNull();
    await waitFor(() => expect(wrapper?.style.transform).toContain('translate(20px'));
    const before = wrapper?.style.transform;
    // The field moves (e.g. a panel grows above it) with no scroll or resize event.
    top = 300;
    await waitFor(() => expect(wrapper?.style.transform).not.toBe(before));
    const y = (value?: string) => Number(/,\s*(-?[\d.]+)px/.exec(value ?? '')?.[1]);
    expect(y(wrapper?.style.transform)).toBeGreaterThan(y(before));
  });

  it('repassa a ref ao gatilho, para o formulário focar o campo com erro', () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <FluxoRoot>
        <Select ref={ref} label="Tipo de conexão" options={fonts} />
      </FluxoRoot>,
    );
    expect(ref.current).toBe(trigger());
  });
});
