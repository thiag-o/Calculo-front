import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import './carregando.css';

export interface EsqueletoProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** Largura da barra: px (número) ou qualquer medida CSS ("40%"). Padrão: ocupa o espaço livre. */
  largura?: number | string;
}

/** Barra do esqueleto (estilos.md §14): 12px, raio 4px, brilho de 1,4s, parado com `prefers-reduced-motion`. */
export function Esqueleto({ largura, className, style, ...resto }: EsqueletoProps) {
  const estilo: CSSProperties = largura === undefined ? { flex: '1 1 0', ...style } : { width: largura, ...style };
  return <span className={['fc-esqueleto', className].filter(Boolean).join(' ')} style={estilo} aria-hidden="true" {...resto} />;
}

export interface CarregandoProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** O que o leitor de tela anuncia. Padrão: "Carregando". Seja específico: "Carregando execuções". */
  rotulo?: string;
  /** Linhas do esqueleto padrão (barras de 110px, 80px e o resto). Padrão: 3. Ignorado com `children`. */
  linhas?: number;
  /** Forma própria, feita com `Esqueleto`, para imitar a lista final. */
  children?: ReactNode;
}

/**
 * Esqueleto de carregamento (estilos.md §14), com a forma da lista final. Sem spinner no meio da página.
 * É uma região `status`: o leitor de tela anuncia o `rotulo`; as barras ficam ocultas para ele.
 */
export function Carregando({ rotulo = 'Carregando', linhas = 3, className, children, ...resto }: CarregandoProps) {
  return (
    <div role="status" aria-live="polite" className={['fc-carregando', className].filter(Boolean).join(' ')} {...resto}>
      <span className="fc-oculto-visualmente">{rotulo}</span>
      <div className="fc-carregando-forma" aria-hidden="true">
        {children ??
          Array.from({ length: linhas }, (_, indice) => (
            <div key={indice} className="fc-carregando-linha">
              <Esqueleto largura={110} />
              <Esqueleto largura={80} />
              <Esqueleto />
            </div>
          ))}
      </div>
    </div>
  );
}
