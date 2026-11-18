import '@testing-library/jest-dom/vitest';
import '../form/jsdom.test-support';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FluxoRoot } from '../root';
import { Tabs, type TabItem, type TabsProps } from '.';

afterEach(cleanup);

type Area = 'users' | 'roles' | 'integration' | 'security';

const AREAS: readonly TabItem<Area>[] = [
  { value: 'users', label: 'Usuários' },
  { value: 'roles', label: 'Papéis' },
  { value: 'integration', label: 'Integração' },
  { value: 'security', label: 'Segurança' },
];

const CONTENT: Record<Area, string> = {
  users: 'Lista de usuários',
  roles: 'Lista de papéis',
  integration: 'Chaves e domínios',
  security: 'Parâmetros de segurança',
};

function renderTabs(props: Partial<TabsProps<Area>> = {}) {
  const user = userEvent.setup({ delay: null });
  const tree = (current: Partial<TabsProps<Area>>) => (
    <FluxoRoot>
      <button type="button">Antes</button>
      <Tabs<Area> label="Administração" items={AREAS} {...current}>
        {(open) => <p>{CONTENT[open]}</p>}
      </Tabs>
    </FluxoRoot>
  );
  const view = render(tree(props));
  return { user, rerenderWith: (newOnes: Partial<TabsProps<Area>>) => view.rerender(tree(newOnes)) };
}

const tab = (name: string) => screen.getByRole('tab', { name });
const tabNames = () => within(screen.getByRole('tablist', { name: 'Administração' })).getAllByRole('tab').map((item) => item.textContent);
const panel = () => screen.getByRole('tabpanel');

describe('Abas', () => {
  it('mostra a lista com nome, a primeira aba aberta e o painel nomeado por ela', () => {
    renderTabs();

    expect(tabNames()).toEqual(['Usuários', 'Papéis', 'Integração', 'Segurança']);
    expect(tab('Usuários')).toHaveAttribute('aria-selected', 'true');
    expect(tab('Papéis')).toHaveAttribute('aria-selected', 'false');
    expect(panel()).toHaveAccessibleName('Usuários');
    expect(panel()).toHaveTextContent('Lista de usuários');
    expect(tab('Usuários')).toHaveAttribute('aria-controls', panel().id);
  });

  it('o clique troca a aba e o painel, e avisa a escolha uma vez', async () => {
    const onValueChange = vi.fn();
    const { user } = renderTabs({ onValueChange });

    await user.click(tab('Papéis'));
    expect(tab('Papéis')).toHaveAttribute('aria-selected', 'true');
    expect(tab('Usuários')).toHaveAttribute('aria-selected', 'false');
    expect(panel()).toHaveTextContent('Lista de papéis');
    expect(screen.queryByText('Lista de usuários')).not.toBeInTheDocument();
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('roles');

    // The open tab notifies nobody.
    await user.click(tab('Papéis'));
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it('defaultValue abre a aba pedida', () => {
    renderTabs({ defaultValue: 'security' });

    expect(tab('Segurança')).toHaveAttribute('aria-selected', 'true');
    expect(panel()).toHaveTextContent('Parâmetros de segurança');
  });

  describe('teclado e foco', () => {
    it('Tab chega à aba aberta; só ela fica na ordem do Tab, e o Tab seguinte vai ao painel', async () => {
      const { user } = renderTabs({ defaultValue: 'roles' });

      screen.getByRole('button', { name: 'Antes' }).focus();
      await user.tab();
      expect(tab('Papéis')).toHaveFocus();
      for (const name of ['Usuários', 'Integração', 'Segurança']) expect(tab(name)).toHaveAttribute('tabindex', '-1');
      expect(tab('Papéis')).toHaveAttribute('tabindex', '0');

      await user.tab();
      expect(panel()).toHaveFocus();

      await user.tab({ shift: true });
      expect(tab('Papéis')).toHaveFocus();
    });

    it('as setas andam e escolhem, dando a volta; Home e End vão às pontas', async () => {
      const onValueChange = vi.fn();
      const { user } = renderTabs({ onValueChange });

      tab('Usuários').focus();
      await user.keyboard('{ArrowRight}');
      expect(tab('Papéis')).toHaveFocus();
      expect(tab('Papéis')).toHaveAttribute('aria-selected', 'true');
      expect(panel()).toHaveTextContent('Lista de papéis');

      await user.keyboard('{End}');
      expect(tab('Segurança')).toHaveFocus();
      expect(panel()).toHaveAccessibleName('Segurança');

      await user.keyboard('{ArrowRight}');
      expect(tab('Usuários')).toHaveFocus();

      await user.keyboard('{ArrowLeft}');
      expect(tab('Segurança')).toHaveFocus();

      await user.keyboard('{Home}');
      expect(tab('Usuários')).toHaveFocus();
      expect(tab('Usuários')).toHaveAttribute('aria-selected', 'true');

      expect(onValueChange.mock.calls.map(([value]) => value)).toEqual(['roles', 'security', 'users', 'security', 'users']);
    });
  });

  describe('controladas por quem usa', () => {
    it('abrem na aba pedida e avisam a escolha sem trocar sozinhas', async () => {
      const onValueChange = vi.fn();
      const { user, rerenderWith } = renderTabs({ value: 'integration', onValueChange });

      expect(tab('Integração')).toHaveAttribute('aria-selected', 'true');

      await user.click(tab('Papéis'));
      expect(onValueChange).toHaveBeenCalledExactlyOnceWith('roles');
      expect(tab('Integração')).toHaveAttribute('aria-selected', 'true');
      expect(panel()).toHaveTextContent('Chaves e domínios');

      rerenderWith({ value: 'roles', onValueChange });
      expect(tab('Papéis')).toHaveAttribute('aria-selected', 'true');
      expect(panel()).toHaveTextContent('Lista de papéis');
    });

    it('pelo teclado, a escolha controlada mantém o foco na aba escolhida', async () => {
      function Controlled() {
        const [open, setOpen] = useState<Area>('users');
        return (
          <FluxoRoot>
            <Tabs<Area> label="Administração" items={AREAS} value={open} onValueChange={setOpen}>
              {(value) => <p>{CONTENT[value]}</p>}
            </Tabs>
          </FluxoRoot>
        );
      }
      const user = userEvent.setup({ delay: null });
      render(<Controlled />);

      tab('Usuários').focus();
      await user.keyboard('{ArrowLeft}');
      expect(tab('Segurança')).toHaveFocus();
      expect(tab('Segurança')).toHaveAttribute('aria-selected', 'true');
      expect(panel()).toHaveTextContent('Parâmetros de segurança');
    });
  });

  describe('permissões', () => {
    it('mostram só as abas recebidas, na ordem dada', () => {
      // Whoever uses the component passes only the tabs the person may see (e.g. integration.manage and security.manage).
      render(
        <FluxoRoot>
          <Tabs label="Administração" items={AREAS.filter((item) => item.value === 'integration' || item.value === 'security')}>
            <p>conteúdo</p>
          </Tabs>
        </FluxoRoot>,
      );

      expect(tabNames()).toEqual(['Integração', 'Segurança']);
      expect(tab('Integração')).toHaveAttribute('aria-selected', 'true');
      expect(screen.queryByRole('tab', { name: 'Usuários' })).not.toBeInTheDocument();
    });

    it('uma aba pedida que não está na lista (sem permissão) abre a primeira permitida', () => {
      const items = AREAS.filter((item) => item.value !== 'users');
      render(
        <FluxoRoot>
          <Tabs<Area> label="Administração" items={items} value="users">
            {(open) => <p>{CONTENT[open]}</p>}
          </Tabs>
        </FluxoRoot>,
      );

      expect(tab('Papéis')).toHaveAttribute('aria-selected', 'true');
      expect(panel()).toHaveTextContent('Lista de papéis');
    });

    it('sem nenhuma aba, não mostra nada', () => {
      render(
        <FluxoRoot>
          <Tabs label="Administração" items={[]}>
            <p>conteúdo</p>
          </Tabs>
        </FluxoRoot>,
      );

      expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
      expect(screen.queryByText('conteúdo')).not.toBeInTheDocument();
    });
  });

  it('tamanho pequeno e classes de layout de quem usa', () => {
    render(
      <FluxoRoot>
        <Tabs label="Administração" items={AREAS} size="small" className="fc-x" listClassName="fc-x-list" panelClassName="fc-x-panel">
          <p>conteúdo</p>
        </Tabs>
      </FluxoRoot>,
    );

    expect(screen.getByRole('tablist').closest('.fc-tabs')).toHaveClass('fc-tabs-small', 'fc-x');
    expect(screen.getByRole('tablist')).toHaveClass('fc-tabs-list', 'fc-x-list');
    expect(panel()).toHaveClass('fc-tabs-panel', 'fc-x-panel');
  });
});
