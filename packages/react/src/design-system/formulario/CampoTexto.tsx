import { forwardRef, type InputHTMLAttributes } from 'react';
import { MensagensCampo, juntarClasses, useIdsCampo, type PropsCampo } from './estruturaCampo';
import { Rotulo } from './Rotulo';
import './campo.css';

/**
 * Tipos de texto aceitos. Senha usa o CampoSenha. `date` usa o calendário do navegador: o valor é `aaaa-mm-dd` (vazio
 * enquanto a data está incompleta) e a tela mostra no formato do idioma de quem usa.
 */
export type TipoCampoTexto = 'text' | 'email' | 'search' | 'tel' | 'url' | 'number' | 'date';

export interface CampoTextoProps extends PropsCampo, Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size' | 'children'> {
  /** Padrão: `text`. */
  type?: TipoCampoTexto;
  /** Classes do contêiner do campo (rótulo, entrada e mensagens). As demais props vão para o `<input>`. */
  className?: string;
}

/**
 * Campo de texto com rótulo, dica e erro (estilos.md §7.2). Repassa a `ref` ao `<input>`, para funcionar com o
 * `register` do react-hook-form.
 */
export const CampoTexto = forwardRef<HTMLInputElement, CampoTextoProps>(function CampoTexto(
  { rotulo, dica, erro, id, className, type = 'text', 'aria-describedby': descritoPorExterno, ...resto },
  ref,
) {
  const ids = useIdsCampo(id, dica, erro, descritoPorExterno);
  return (
    <div className={juntarClasses('fc-campo', className)}>
      <Rotulo htmlFor={ids.id}>{rotulo}</Rotulo>
      <input
        {...resto}
        ref={ref}
        id={ids.id}
        type={type}
        className="fc-campo-entrada"
        aria-invalid={ids.invalido || undefined}
        aria-describedby={ids.descritoPor}
      />
      <MensagensCampo ids={ids} dica={dica} erro={erro} />
    </div>
  );
});
