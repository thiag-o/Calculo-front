import '@testing-library/jest-dom/vitest';
import './jsdom.test-support';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FluxoRoot } from '../root';
import { Button, type ReasonDisplay } from '.';

afterEach(cleanup);

const reason = 'Resolva 1 problema e 1 teste para enviar';

function TestIcon() {
  return <svg data-testid="icon" aria-hidden="true" />;
}

describe('Botao', () => {
  it('é um botão com o texto como nome, do tipo button por padrão', () => {
    render(<Button variant="primary">Abrir editor</Button>);
    const button = screen.getByRole('button', { name: 'Abrir editor' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).not.toHaveAttribute('aria-disabled');
  });

  it.each([
    ['primary', 'fc-button-primary'],
    ['secondary', 'fc-button-secondary'],
    ['ghost', 'fc-button-ghost'],
    ['danger', 'fc-button-danger'],
  ] as const)('variante %s', (variant, cssClass) => {
    render(<Button variant={variant}>Executar lote</Button>);
    expect(screen.getByRole('button')).toHaveClass('fc-button', cssClass);
  });

  it('é secundário e de 32px por padrão; aceita pequeno e grande', () => {
    const { rerender } = render(<Button>Simular</Button>);
    expect(screen.getByRole('button')).toHaveClass('fc-button-secondary');
    expect(screen.getByRole('button')).not.toHaveClass('fc-button-small', 'fc-button-large');
    rerender(<Button size="small">Simular</Button>);
    expect(screen.getByRole('button')).toHaveClass('fc-button-small');
    rerender(<Button size="large">Simular</Button>);
    expect(screen.getByRole('button')).toHaveClass('fc-button-large');
  });

  it('aciona pelo clique, pelo Enter e pelo Espaço', async () => {
    const user = userEvent.setup({ delay: null });
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Executar lote</Button>);
    await user.click(screen.getByRole('button'));
    screen.getByRole('button').focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it('recebe o foco pelo Tab', async () => {
    const user = userEvent.setup({ delay: null });
    render(<Button>Executar lote</Button>);
    await user.tab();
    expect(screen.getByRole('button', { name: 'Executar lote' })).toHaveFocus();
  });

  it('repassa a ref, o id e atributos aria', () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <Button ref={ref} id="submit" aria-describedby="external-help">
        Enviar para revisão
      </Button>,
    );
    expect(ref.current).toBe(screen.getByRole('button'));
    expect(ref.current).toHaveAttribute('id', 'submit');
    expect(ref.current).toHaveAttribute('aria-describedby', 'external-help');
  });

  it('mostra o ícone antes do texto', () => {
    render(<Button icon={<TestIcon />}>Rodar testes</Button>);
    const button = screen.getByRole('button', { name: 'Rodar testes' });
    expect(button.firstElementChild).toBe(screen.getByTestId('icon'));
  });
});

describe('Botao desabilitado com motivo', () => {
  function renderScreen(props: { showReason?: ReasonDisplay } = {}) {
    const onClick = vi.fn();
    const onSubmit = vi.fn((event: { preventDefault(): void }) => event.preventDefault());
    render(
      <FluxoRoot>
        <form onSubmit={onSubmit}>
          <input aria-label="Mensagem da versão" />
          <Button variant="primary" type="submit" disabledReason={reason} onClick={onClick} {...props}>
            Enviar para revisão
          </Button>
        </form>
      </FluxoRoot>,
    );
    return { onClick, onSubmit, button: screen.getByRole('button', { name: 'Enviar para revisão' }) };
  }

  it('fica com aria-disabled e o motivo como descrição acessível', () => {
    const { button } = renderScreen();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAccessibleDescription(reason);
    expect(button).toHaveClass('fc-button-disabled');
  });

  it('continua focável pelo teclado, para o motivo ser lido', async () => {
    const user = userEvent.setup({ delay: null });
    const { button } = renderScreen();
    await user.tab();
    await user.tab();
    expect(button).toHaveFocus();
  });

  it('não aciona nem envia o formulário pelo clique, Enter, Espaço ou Enter no campo', async () => {
    const user = userEvent.setup({ delay: null });
    const { onClick, onSubmit, button } = renderScreen();
    await user.click(button);
    button.focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    await user.click(screen.getByRole('textbox', { name: 'Mensagem da versão' }));
    await user.keyboard('{Enter}');
    expect(onClick).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('mostra o motivo na dica ao receber o foco, dentro da raiz do módulo, e Esc fecha', async () => {
    const user = userEvent.setup({ delay: null });
    const { button } = renderScreen();
    await user.tab();
    await user.tab();
    expect(button).toHaveFocus();
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent(reason);
    expect(tooltip.closest('.fc-portals')).not.toBeNull();
    // The description is not duplicated with the tooltip open.
    expect(button).toHaveAccessibleDescription(reason);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(button).toHaveFocus();
  });

  it('mostra o motivo na dica ao passar o mouse', async () => {
    const user = userEvent.setup({ delay: null });
    const { button } = renderScreen();
    await user.hover(button);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(reason);
    await user.unhover(button);
  });

  it('com o motivo ao lado: texto visível ligado por aria-describedby, sem dica', async () => {
    const user = userEvent.setup({ delay: null });
    const { button } = renderScreen({ showReason: 'beside' });
    const text = screen.getByText(reason);
    expect(text).toBeVisible();
    expect(button).toHaveAccessibleDescription(reason);
    expect(text).toHaveClass('fc-label-12', 'fc-text-secondary');
    button.focus();
    await user.hover(button);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('volta a funcionar quando o motivo some', async () => {
    const user = userEvent.setup({ delay: null });
    const onClick = vi.fn();
    const { rerender } = render(
      <FluxoRoot>
        <Button disabledReason={reason} onClick={onClick}>
          Enviar para revisão
        </Button>
      </FluxoRoot>,
    );
    rerender(
      <FluxoRoot>
        <Button disabledReason={undefined} onClick={onClick}>
          Enviar para revisão
        </Button>
      </FluxoRoot>,
    );
    const button = screen.getByRole('button', { name: 'Enviar para revisão' });
    expect(button).not.toHaveAttribute('aria-disabled');
    expect(button).not.toHaveAttribute('aria-describedby');
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('Botao carregando', () => {
  it('marca aria-busy, troca o ícone pelo indicador e ignora cliques', async () => {
    const user = userEvent.setup({ delay: null });
    const onClick = vi.fn();
    render(
      <Button variant="primary" loading icon={<TestIcon />} onClick={onClick}>
        Entrar
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Entrar' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByTestId('icon')).toBeNull();
    expect(button.querySelector('.fc-button-spinning')).not.toBeNull();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('não perde o foco ao começar a carregar', async () => {
    const user = userEvent.setup({ delay: null });
    const { rerender } = render(<Button type="submit">Entrar</Button>);
    await user.tab();
    rerender(
      <Button type="submit" loading>
        Entrar
      </Button>,
    );
    expect(screen.getByRole('button', { name: 'Entrar' })).toHaveFocus();
  });

  it('não envia o formulário enquanto carrega', async () => {
    const user = userEvent.setup({ delay: null });
    const onSubmit = vi.fn((event: { preventDefault(): void }) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit" loading>
          Entrar
        </Button>
      </form>,
    );
    await user.click(screen.getByRole('button'));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('Botao só ícone', () => {
  it('é quadrado, usa o rótulo como nome acessível e mostra o nome na dica', async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <FluxoRoot>
        <Button iconOnly label="Mais ações" icon={<TestIcon />} />
      </FluxoRoot>,
    );
    const button = screen.getByRole('button', { name: 'Mais ações' });
    expect(button).toHaveClass('fc-button-icon-only');
    expect(button.querySelector('.fc-button-text')).toBeNull();
    expect(button).not.toHaveAttribute('aria-describedby');
    await user.tab();
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Mais ações');
  });

  it('desabilitado, mostra o nome e o motivo na dica', async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <FluxoRoot>
        <Button iconOnly label="Excluir conexão" icon={<TestIcon />} variant="ghost" disabledReason="Conexão em uso por 2 workflows" />
      </FluxoRoot>,
    );
    const button = screen.getByRole('button', { name: 'Excluir conexão' });
    expect(button).toHaveAccessibleDescription('Conexão em uso por 2 workflows');
    await user.tab();
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Excluir conexão');
    expect(tooltip).toHaveTextContent('Conexão em uso por 2 workflows');
  });
});
