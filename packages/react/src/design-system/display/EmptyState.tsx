import type { HTMLAttributes, ReactNode } from 'react';
import { textClasses } from '../typography';
import { EmptyIcon } from './icons';
import './empty-state.css';

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** What is missing, in one sentence: "Nenhuma execução ainda". */
  title: ReactNode;
  /** What to do: "Publique uma versão e execute o primeiro lote." */
  description?: ReactNode;
  /** One action, usually a small `Button` with verb + object ("Executar lote"). */
  action?: ReactNode;
  /** 16px outline Lucide icon. Default: inbox. */
  icon?: ReactNode;
}

/** Empty state (estilos.md §7.7 and §14): outline icon, one sentence and one action. No illustration. */
export function EmptyState({ title, description, action, icon, className, ...rest }: EmptyStateProps) {
  return (
    <div className={['fc-empty-state', className].filter(Boolean).join(' ')} {...rest}>
      <span className="fc-empty-state-icon" aria-hidden="true">
        {icon ?? <EmptyIcon />}
      </span>
      <div className="fc-empty-state-text">
        <p className={`fc-empty-state-title ${textClasses({ variant: 'label-14', medium: true })}`}>{title}</p>
        {description ? <p className={textClasses({ variant: 'label-13', emphasis: 'secondary' })}>{description}</p> : null}
      </div>
      {action ? <div className="fc-empty-state-action">{action}</div> : null}
    </div>
  );
}
