import * as Checkbox from '@radix-ui/react-checkbox';
import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { classesTexto } from '../tipografia';
import { MensagensCampo, juntarClasses, useIdsCampo, type PropsCampo } from './estruturaCampo';
import { IconeMarca, IconeMenos } from './icones';
import './campo.css';
import './caixa-selecao.css';

type PropsCheckbox = Omit<ComponentPropsWithoutRef<typeof Checkbox.Root>, 'asChild' | 'children'>;

export interface CaixaSelecaoProps extends PropsCampo, PropsCheckbox {
  /** Classes do contêiner (caixa, rótulo e mensagens). As demais props vão para a caixa (Radix Checkbox). */
  className?: string;
}

/**
 * Caixa de seleção (Radix Checkbox) com rótulo ao lado, dica e erro (estilos.md §7.2).
 * Aceita `checked`/`onCheckedChange` (controlada) ou `defaultChecked`, e o estado `'indeterminate'`.
 * Espaço alterna; clicar no rótulo também. Com `name`, participa do envio de formulários.
 */
export const CaixaSelecao = forwardRef<HTMLButtonElement, CaixaSelecaoProps>(function CaixaSelecao(
  { rotulo, dica, erro, id, className, 'aria-describedby': descritoPorExterno, ...resto },
  ref,
) {
  const ids = useIdsCampo(id, dica, erro, descritoPorExterno);
  return (
    <div className={juntarClasses('fc-caixa-selecao', resto.disabled && 'fc-caixa-selecao-desabilitada', className)}>
      <div className="fc-caixa-selecao-linha">
        <Checkbox.Root
          {...resto}
          ref={ref}
          id={ids.id}
          className="fc-caixa-selecao-caixa"
          aria-invalid={ids.invalido || undefined}
          aria-describedby={ids.descritoPor}
        >
          <Checkbox.Indicator className="fc-caixa-selecao-indicador">
            <IconeMarca tamanho={12} className="fc-caixa-selecao-marca" />
            <IconeMenos tamanho={12} className="fc-caixa-selecao-traco" />
          </Checkbox.Indicator>
        </Checkbox.Root>
        <label htmlFor={ids.id} className={juntarClasses('fc-caixa-selecao-rotulo', classesTexto({ estilo: 'copy-14' }))}>
          {rotulo}
        </label>
      </div>
      <MensagensCampo ids={ids} dica={dica} erro={erro} />
    </div>
  );
});
