import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { MensagensCampo, juntarClasses, useIdsCampo, type PropsCampo } from './estruturaCampo';
import { IconeOlho, IconeOlhoRiscado } from './icones';
import { Rotulo } from './Rotulo';
import './campo.css';

export interface CampoSenhaProps extends PropsCampo, Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size' | 'children'> {
  /** Classes do contêiner do campo (rótulo, entrada e mensagens). As demais props vão para o `<input>`. */
  className?: string;
}

/**
 * Campo de senha com rótulo, dica, erro e o botão "Mostrar senha" (alternância com `aria-pressed`).
 * A senha começa oculta. `autoComplete` padrão: `current-password` (use `new-password` ao definir uma senha).
 * Repassa a `ref` ao `<input>`, para funcionar com o `register` do react-hook-form.
 */
export const CampoSenha = forwardRef<HTMLInputElement, CampoSenhaProps>(function CampoSenha(
  { rotulo, dica, erro, id, className, autoComplete = 'current-password', 'aria-describedby': descritoPorExterno, ...resto },
  ref,
) {
  const ids = useIdsCampo(id, dica, erro, descritoPorExterno);
  const [visivel, setVisivel] = useState(false);

  return (
    <div className={juntarClasses('fc-campo', className)}>
      <Rotulo htmlFor={ids.id}>{rotulo}</Rotulo>
      <div className="fc-campo-senha">
        <input
          {...resto}
          ref={ref}
          id={ids.id}
          type={visivel ? 'text' : 'password'}
          autoComplete={autoComplete}
          autoCapitalize="off"
          spellCheck={false}
          className="fc-campo-entrada"
          aria-invalid={ids.invalido || undefined}
          aria-describedby={ids.descritoPor}
        />
        <button
          type="button"
          className="fc-campo-senha-alternar"
          aria-label="Mostrar senha"
          aria-pressed={visivel}
          aria-controls={ids.id}
          disabled={resto.disabled}
          onClick={() => setVisivel((atual) => !atual)}
        >
          {visivel ? <IconeOlhoRiscado /> : <IconeOlho />}
        </button>
      </div>
      <MensagensCampo ids={ids} dica={dica} erro={erro} />
    </div>
  );
});
