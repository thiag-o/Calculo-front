import * as Select from '@radix-ui/react-select';
import { forwardRef, type FocusEventHandler } from 'react';
import { usePortalFluxo } from '../raiz';
import { MensagensCampo, juntarClasses, useIdsCampo, type PropsCampo } from './estruturaCampo';
import { IconeMarca, IconeSetaBaixo } from './icones';
import { Rotulo } from './Rotulo';
import './campo.css';
import './selecao.css';

export interface OpcaoSelecao {
  /** Valor enviado (não pode ser vazio). */
  valor: string;
  rotulo: string;
  desabilitada?: boolean;
}

export interface SelecaoProps extends PropsCampo {
  opcoes: readonly OpcaoSelecao[];
  /** Valor controlado. `''` volta ao texto de espera. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (valor: string) => void;
  /** Texto enquanto nada foi escolhido. Padrão: "Selecione". */
  placeholder?: string;
  /** Nome no envio de formulários. */
  name?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  onBlur?: FocusEventHandler<HTMLButtonElement>;
  'aria-describedby'?: string;
  /** Classes do contêiner do campo (rótulo, gatilho e mensagens). */
  className?: string;
}

/**
 * Seleção de uma opção (Radix Select) com rótulo, dica e erro (estilos.md §7.2).
 * Teclado: Enter, Espaço e as setas abrem; as setas e a digitação navegam; Enter escolhe; Esc fecha e devolve o foco.
 * A lista abre no contêiner de portais da raiz do módulo, então precisa estar dentro de `<RaizFluxo>`.
 * A `ref` vai para o gatilho, para o react-hook-form focar o campo com erro (use com `Controller`).
 */
export const Selecao = forwardRef<HTMLButtonElement, SelecaoProps>(function Selecao(
  {
    rotulo,
    dica,
    erro,
    opcoes,
    value,
    defaultValue,
    onValueChange,
    placeholder = 'Selecione',
    name,
    required,
    disabled,
    id,
    onBlur,
    'aria-describedby': descritoPorExterno,
    className,
  },
  ref,
) {
  const ids = useIdsCampo(id, dica, erro, descritoPorExterno);
  const portal = usePortalFluxo();

  return (
    <div className={juntarClasses('fc-campo', className)}>
      <Rotulo htmlFor={ids.id}>{rotulo}</Rotulo>
      <Select.Root
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        name={name}
        required={required}
        disabled={disabled}
      >
        <Select.Trigger
          ref={ref}
          id={ids.id}
          className="fc-selecao-gatilho"
          aria-invalid={ids.invalido || undefined}
          aria-describedby={ids.descritoPor}
          onBlur={onBlur}
        >
          <Select.Value className="fc-selecao-valor" placeholder={placeholder} />
          <Select.Icon className="fc-selecao-seta">
            <IconeSetaBaixo />
          </Select.Icon>
        </Select.Trigger>
        {portal && (
          <Select.Portal container={portal}>
            <Select.Content className="fc-selecao-conteudo" position="popper" sideOffset={4} collisionPadding={8}>
              <Select.Viewport className="fc-selecao-lista">
                {opcoes.map((opcao) => (
                  <Select.Item key={opcao.valor} value={opcao.valor} disabled={opcao.desabilitada} className="fc-selecao-item">
                    <Select.ItemText>
                      <span className="fc-selecao-item-texto">{opcao.rotulo}</span>
                    </Select.ItemText>
                    <Select.ItemIndicator className="fc-selecao-marca">
                      <IconeMarca />
                    </Select.ItemIndicator>
                  </Select.Item>
                ))}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        )}
      </Select.Root>
      <MensagensCampo ids={ids} dica={dica} erro={erro} />
    </div>
  );
});
