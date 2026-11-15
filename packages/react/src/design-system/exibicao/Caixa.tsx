import type { HTMLAttributes } from 'react';
import './caixa.css';

/** `padrao`: 16px por dentro (cards). `nenhum`: para listas e tabelas, cujas linhas têm o próprio espaço. */
export type EspacoCaixa = 'padrao' | 'nenhum';

export interface CaixaProps extends HTMLAttributes<HTMLElement> {
  /** Elemento HTML. Padrão: div. Use `section` com título, `article` em cards e `li` dentro de listas. */
  como?: 'div' | 'section' | 'article' | 'aside' | 'li';
  /** Padrão: `padrao`. */
  espaco?: EspacoCaixa;
}

/** Caixa de conteúdo (estilos.md §7.6): background-100, borda 1px, raio 12px, sem sombra. */
export function Caixa({ como: Elemento = 'div', espaco = 'padrao', className, ...resto }: CaixaProps) {
  const classes = ['fc-caixa', espaco === 'nenhum' ? 'fc-caixa-sem-espaco' : null, className].filter(Boolean).join(' ');
  return <Elemento className={classes} {...resto} />;
}
