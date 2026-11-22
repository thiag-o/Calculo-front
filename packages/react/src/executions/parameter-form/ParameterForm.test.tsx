import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../api';
import { parameter, parameterProblem, renderScreen } from './parameter-form.test-support';

const sent = () => screen.getByLabelText('Enviado').textContent;

describe('ParameterForm', () => {
  describe('um campo por tipo', () => {
    it('texto: envia o que foi digitado e não envia o campo vazio', async () => {
      const { user } = renderScreen({ parameters: [parameter('regiao', 'text'), parameter('filial', 'text')] });
      await user.click(screen.getByLabelText('regiao'));
      await user.paste('Norte');
      await user.click(screen.getByRole('button', { name: 'Enviar' }));
      expect(sent()).toBe('{"regiao":"Norte"}');
    });

    it('inteiro: digita no padrão brasileiro e envia com ponto', async () => {
      const { user } = renderScreen({ parameters: [parameter('minimo', 'integer')] });
      await user.click(screen.getByLabelText('minimo'));
      await user.paste('1.500');
      await user.click(screen.getByRole('button', { name: 'Enviar' }));
      expect(sent()).toBe('{"minimo":"1500"}');
    });

    it('decimal: vírgula nos decimais, enviado como texto com ponto', async () => {
      const { user } = renderScreen({ parameters: [parameter('meta', 'decimal', { scale: 2 })] });
      await user.click(screen.getByLabelText('meta'));
      await user.paste('1.500,5');
      await user.click(screen.getByRole('button', { name: 'Enviar' }));
      expect(sent()).toBe('{"meta":"1500.5"}');
    });

    it('decimal: recusa casas a mais e ponto como decimal, no campo, sem enviar', async () => {
      const { user } = renderScreen({ parameters: [parameter('meta', 'decimal', { scale: 2 })] });
      const field = screen.getByLabelText('meta');
      await user.click(field);
      await user.paste('1,234');
      await user.click(screen.getByRole('button', { name: 'Enviar' }));
      expect(await screen.findByText('Use no máximo 2 casas decimais.')).toBeInTheDocument();
      expect(field).toBeInvalid();
      expect(sent()).toBe('');

      await user.clear(field);
      await user.paste('1500.50');
      await user.click(screen.getByRole('button', { name: 'Enviar' }));
      expect(await screen.findByText('Use vírgula para separar os decimais, como 1.500,50.')).toBeInTheDocument();
    });

    it('data: envia aaaa-mm-dd', async () => {
      const { user } = renderScreen({ parameters: [parameter('corte', 'date')] });
      fireEvent.change(screen.getByLabelText('corte'), { target: { value: '2026-10-05' } });
      await user.click(screen.getByRole('button', { name: 'Enviar' }));
      expect(sent()).toBe('{"corte":"2026-10-05"}');
    });

    it('data e hora: envia ISO 8601 em UTC', async () => {
      const { user } = renderScreen({ parameters: [parameter('momento', 'datetime')] });
      fireEvent.change(screen.getByLabelText('momento'), { target: { value: '2026-10-05T10:30:00' } });
      await user.click(screen.getByRole('button', { name: 'Enviar' }));
      expect(sent()).toBe(`{"momento":"${new Date('2026-10-05T10:30:00').toISOString()}"}`);
    });

    it('booleano: escolhe Verdadeiro e envia true; Vazio não envia', async () => {
      const { user } = renderScreen({ parameters: [parameter('ativo', 'boolean')] });
      await user.click(screen.getByRole('combobox', { name: 'ativo' }));
      await user.click(await screen.findByRole('option', { name: 'Verdadeiro' }));
      await user.click(screen.getByRole('button', { name: 'Enviar' }));
      expect(sent()).toBe('{"ativo":true}');

      await user.click(screen.getByRole('combobox', { name: 'ativo' }));
      await user.click(await screen.findByRole('option', { name: 'Vazio' }));
      await user.click(screen.getByRole('button', { name: 'Enviar' }));
      expect(sent()).toBe('{}');
    });

    it('mostra o padrão fixo lido do literal, no padrão brasileiro, e o envia', async () => {
      const { user } = renderScreen({
        parameters: [
          parameter('regiao', 'text', { default: { kind: 'fixed', value: '"Sul ""A"""' } }),
          parameter('meta', 'decimal', { scale: 2, default: { kind: 'fixed', value: '1500.5' } }),
          parameter('corte', 'date', { default: { kind: 'fixed', value: 'DATA(2026, 10, 1)' } }),
          parameter('ativo', 'boolean', { default: { kind: 'fixed', value: 'verdadeiro' } }),
        ],
      });
      expect(screen.getByLabelText('regiao')).toHaveValue('Sul "A"');
      expect(screen.getByLabelText('meta')).toHaveValue('1.500,5');
      expect(screen.getByLabelText('corte')).toHaveValue('2026-10-01');
      expect(screen.getByRole('combobox', { name: 'ativo' })).toHaveTextContent('Verdadeiro');
      await user.click(screen.getByRole('button', { name: 'Enviar' }));
      expect(sent()).toBe('{"regiao":"Sul \\"A\\"","meta":"1500.5","corte":"2026-10-01","ativo":true}');
    });

    it('com valores permitidos, escolhe entre eles e envia o texto da API', async () => {
      const { user } = renderScreen({
        parameters: [parameter('corte', 'date', { allowed_values: ['DATA(2026, 10, 1)', 'DATA(2026, 11, 1)'] })],
      });
      await user.click(screen.getByRole('combobox', { name: 'corte' }));
      await user.click(await screen.findByRole('option', { name: '01/11/2026' }));
      await user.click(screen.getByRole('button', { name: 'Enviar' }));
      expect(sent()).toBe('{"corte":"2026-11-01"}');
    });

    it('mostra o tipo, o "obrigatório" e a descrição sob o campo', () => {
      renderScreen({ parameters: [parameter('meta', 'decimal', { scale: 2, required: true, description: 'Meta do mês' })] });
      expect(screen.getByLabelText('meta')).toHaveAccessibleDescription('Número com 2 casas, obrigatório. Meta do mês');
    });

    it('desabilitado: nenhum campo aceita edição', () => {
      renderScreen({
        disabled: true,
        parameters: [parameter('regiao', 'text'), parameter('periodo', 'period'), parameter('lojas', 'text', { list: true })],
      });
      expect(screen.getByLabelText('regiao')).toBeDisabled();
      expect(screen.getByLabelText('Início')).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Adicionar a lojas' })).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('Período', () => {
    it('tem duas datas e envia start e end', async () => {
      const { user } = renderScreen({ parameters: [parameter('periodo', 'period')] });
      const group = screen.getByRole('group', { name: 'periodo' });
      fireEvent.change(within(group).getByLabelText('Início'), { target: { value: '2026-10-01' } });
      fireEvent.change(within(group).getByLabelText('Fim'), { target: { value: '2026-10-31' } });
      await user.click(screen.getByRole('button', { name: 'Enviar' }));
      expect(sent()).toBe('{"periodo":{"start":"2026-10-01","end":"2026-10-31"}}');
    });

    it('lê o padrão fixo {start, end} dos literais DATA', () => {
      renderScreen({
        parameters: [parameter('periodo', 'period', { default: { kind: 'fixed', value: { start: 'DATA(2026, 10, 1)', end: 'DATA(2026, 10, 31)' } } })],
      });
      expect(screen.getByLabelText('Início')).toHaveValue('2026-10-01');
      expect(screen.getByLabelText('Fim')).toHaveValue('2026-10-31');
    });

    it('com só uma das datas, pede as duas e não envia', async () => {
      const { user } = renderScreen({ parameters: [parameter('periodo', 'period')] });
      fireEvent.change(screen.getByLabelText('Início'), { target: { value: '2026-10-01' } });
      await user.click(screen.getByRole('button', { name: 'Enviar' }));
      expect(await screen.findByText('Informe o início e o fim do período.')).toBeInTheDocument();
      expect(sent()).toBe('');
    });

    it('início depois do fim: avisa no formulário, envia, e o 422 do back aparece no campo', async () => {
      const { user } = renderScreen({
        parameters: [parameter('periodo', 'period'), parameter('meta', 'integer')],
        answer: parameterProblem('invalid_parameter', { periodo: 'O início do período vem depois do fim.' }),
      });
      fireEvent.change(screen.getByLabelText('Início'), { target: { value: '2026-10-31' } });
      fireEvent.change(screen.getByLabelText('Fim'), { target: { value: '2026-10-01' } });
      const group = screen.getByRole('group', { name: 'periodo' });
      expect(within(group).getByRole('status')).toHaveTextContent('O início do período vem depois do fim. Confira as datas.');

      await user.click(screen.getByRole('button', { name: 'Enviar' }));
      expect(sent()).toBe('{"periodo":{"start":"2026-10-31","end":"2026-10-01"}}');
      // The back's message takes the place of the warning, in the field of the period only.
      expect(await within(group).findByText('O início do período vem depois do fim.')).toBeInTheDocument();
      expect(within(group).queryByRole('status')).not.toBeInTheDocument();
      expect(screen.getByLabelText('meta')).not.toBeInvalid();

      // Editing the period clears the back's error.
      fireEvent.change(screen.getByLabelText('Início'), { target: { value: '2026-10-01' } });
      expect(within(group).queryByText('O início do período vem depois do fim.')).not.toBeInTheDocument();
    });
  });

  describe('lista', () => {
    it('com valores permitidos: seleção múltipla, enviada na ordem da declaração', async () => {
      const { user } = renderScreen({
        parameters: [parameter('categorias', 'text', { list: true, allowed_values: ['"A"', '"B"', '"C"'] })],
      });
      const group = screen.getByRole('group', { name: 'categorias' });
      await user.click(within(group).getByRole('checkbox', { name: 'C' }));
      await user.click(within(group).getByRole('checkbox', { name: 'A' }));
      await user.click(screen.getByRole('button', { name: 'Enviar' }));
      expect(sent()).toBe('{"categorias":["A","C"]}');

      await user.click(within(group).getByRole('checkbox', { name: 'A' }));
      await user.click(screen.getByRole('button', { name: 'Enviar' }));
      expect(sent()).toBe('{"categorias":["C"]}');
    });

    it('com valores permitidos: o padrão vem marcado', () => {
      renderScreen({
        parameters: [
          parameter('categorias', 'text', { list: true, allowed_values: ['"A"', '"B"'], default: { kind: 'fixed', value: ['"B"'] } }),
        ],
      });
      expect(screen.getByRole('checkbox', { name: 'B' })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: 'A' })).not.toBeChecked();
    });

    it('sem valores permitidos: etiquetas, com Enter ou Adicionar, e remove uma', async () => {
      const { user } = renderScreen({ parameters: [parameter('lojas', 'integer', { list: true })] });
      const field = screen.getByLabelText('lojas');
      await user.click(field);
      await user.paste('10');
      await user.keyboard('{Enter}');
      await user.paste('2.000');
      await user.click(screen.getByRole('button', { name: 'Adicionar a lojas' }));
      await user.click(field);
      await user.paste('30');
      await user.keyboard('{Enter}');

      const tags = screen.getByRole('list', { name: 'Valores de lojas' });
      expect(within(tags).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['10', '2.000', '30']);
      // Enter adds the tag; it does not send the form.
      expect(sent()).toBe('');

      await user.click(within(tags).getByRole('button', { name: 'Remover 2.000' }));
      await user.click(screen.getByRole('button', { name: 'Enviar' }));
      expect(sent()).toBe('{"lojas":["10","30"]}');
    });

    it('sem valores permitidos: recusa valor fora do tipo e repetido', async () => {
      const { user } = renderScreen({ parameters: [parameter('lojas', 'integer', { list: true })] });
      const field = screen.getByLabelText('lojas');
      await user.click(field);
      await user.paste('abc');
      await user.keyboard('{Enter}');
      expect(await screen.findByText('Digite um número inteiro, como 1.500.')).toBeInTheDocument();

      await user.clear(field);
      await user.paste('10');
      await user.keyboard('{Enter}');
      await user.paste('10');
      await user.keyboard('{Enter}');
      expect(await screen.findByText('Esse valor já está na lista.')).toBeInTheDocument();
    });

    it('o padrão fixo da lista aparece como etiquetas', () => {
      renderScreen({ parameters: [parameter('lojas', 'integer', { list: true, default: { kind: 'fixed', value: ['10', '1500'] } })] });
      const tags = screen.getByRole('list', { name: 'Valores de lojas' });
      expect(within(tags).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['10', '1.500']);
    });
  });

  describe('padrão relativo', () => {
    const relative = parameter('periodo', 'period', { default: { kind: 'relative', value: 'previous_month' } });

    it('aparece pelo rótulo e não é enviado: o back resolve', async () => {
      const { user } = renderScreen({ parameters: [relative] });
      const group = screen.getByRole('group', { name: 'periodo' });
      expect(within(group).getByText('Mês anterior')).toBeInTheDocument();
      expect(within(group).queryByLabelText('Início')).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Enviar' }));
      expect(sent()).toBe('{}');
    });

    it('"Trocar por um valor fixo" abre o campo; "Voltar ao padrão" devolve o relativo', async () => {
      const { user } = renderScreen({ parameters: [relative] });
      await user.click(screen.getByRole('button', { name: 'Trocar por um valor fixo' }));
      fireEvent.change(screen.getByLabelText('Início'), { target: { value: '2026-09-01' } });
      fireEvent.change(screen.getByLabelText('Fim'), { target: { value: '2026-09-30' } });
      await user.click(screen.getByRole('button', { name: 'Enviar' }));
      expect(sent()).toBe('{"periodo":{"start":"2026-09-01","end":"2026-09-30"}}');

      await user.click(screen.getByRole('button', { name: 'Voltar ao padrão (Mês anterior)' }));
      expect(screen.getByText('Mês anterior')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Enviar' }));
      expect(sent()).toBe('{}');
    });

    it('cada relativo tem o seu rótulo (data e data e hora)', () => {
      renderScreen({
        parameters: [
          parameter('inicio', 'date', { default: { kind: 'relative', value: 'first_day_of_previous_month' } }),
          parameter('agora', 'datetime', { default: { kind: 'relative', value: 'now' } }),
        ],
      });
      expect(screen.getByText('Primeiro dia do mês anterior')).toBeInTheDocument();
      expect(screen.getByText('Agora')).toBeInTheDocument();
    });
  });

  describe('erros do back', () => {
    it('missing_parameter cai no campo do parâmetro certo', async () => {
      const { user } = renderScreen({
        parameters: [parameter('regiao', 'text'), parameter('meta_minima', 'decimal', { scale: 2, required: true })],
        answer: parameterProblem('missing_parameter', { meta_minima: 'Informe um valor; o parâmetro é obrigatório e não tem padrão.' }),
      });
      await user.click(screen.getByRole('button', { name: 'Enviar' }));
      const message = 'Informe um valor; o parâmetro é obrigatório e não tem padrão.';
      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(screen.getByLabelText('meta_minima')).toBeInvalid();
      expect(screen.getByLabelText('meta_minima')).toHaveAccessibleDescription(expect.stringContaining(message));
      expect(screen.getByLabelText('regiao')).not.toBeInvalid();
    });

    it('invalid_parameter cai no campo e some quando o valor muda', async () => {
      const { user } = renderScreen({
        parameters: [parameter('regiao', 'text', { allowed_values: ['"N"', '"S"'] })],
        answer: parameterProblem('invalid_parameter', { regiao: 'O valor não está entre os permitidos.' }),
      });
      await user.click(screen.getByRole('combobox', { name: 'regiao' }));
      await user.click(await screen.findByRole('option', { name: 'N' }));
      await user.click(screen.getByRole('button', { name: 'Enviar' }));
      expect(await screen.findByText('O valor não está entre os permitidos.')).toBeInTheDocument();

      await user.click(screen.getByRole('combobox', { name: 'regiao' }));
      await user.click(await screen.findByRole('option', { name: 'S' }));
      expect(screen.queryByText('O valor não está entre os permitidos.')).not.toBeInTheDocument();
    });

    it('outro erro não é do formulário: devolve falso para quem chama mostrar', async () => {
      const { user } = renderScreen({
        parameters: [parameter('regiao', 'text')],
        answer: new ApiError({ status: 409, code: 'draft_conflict', message: 'O rascunho mudou.' }),
      });
      await user.click(screen.getByRole('button', { name: 'Enviar' }));
      expect(screen.getByLabelText('Falha')).toHaveTextContent('O rascunho mudou.');
    });
  });

  it('sem parâmetros, não desenha nada', () => {
    renderScreen({ parameters: [] });
    expect(screen.queryByRole('group', { name: 'Parâmetros' })).not.toBeInTheDocument();
  });
});
