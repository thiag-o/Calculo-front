import type { HTMLAttributes, ReactNode } from 'react';
import { classesTexto } from '../tipografia';
import { IconeVazio } from './icones';
import './estado-vazio.css';

export interface EstadoVazioProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** O que falta, numa frase: "Nenhuma execução ainda". */
  titulo: ReactNode;
  /** O que fazer: "Publique uma versão e execute o primeiro lote." */
  descricao?: ReactNode;
  /** Uma ação, em geral um `Botao` pequeno com verbo + objeto ("Executar lote"). */
  acao?: ReactNode;
  /** Ícone Lucide de 16px, em contorno. Padrão: caixa de entrada. */
  icone?: ReactNode;
}

/** Estado vazio (estilos.md §7.7 e §14): ícone em contorno, uma frase e uma ação. Sem ilustração. */
export function EstadoVazio({ titulo, descricao, acao, icone, className, ...resto }: EstadoVazioProps) {
  return (
    <div className={['fc-estado-vazio', className].filter(Boolean).join(' ')} {...resto}>
      <span className="fc-estado-vazio-icone" aria-hidden="true">
        {icone ?? <IconeVazio />}
      </span>
      <div className="fc-estado-vazio-texto">
        <p className={`fc-estado-vazio-titulo ${classesTexto({ estilo: 'label-14', medio: true })}`}>{titulo}</p>
        {descricao ? <p className={classesTexto({ estilo: 'label-13', tom: 'secundario' })}>{descricao}</p> : null}
      </div>
      {acao ? <div className="fc-estado-vazio-acao">{acao}</div> : null}
    </div>
  );
}
