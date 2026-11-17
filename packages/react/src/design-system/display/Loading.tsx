import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import './loading.css';

export interface SkeletonProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** Bar width: px (number) or any CSS measure ("40%"). Default: takes the free space. */
  width?: number | string;
}

/** Skeleton bar (estilos.md §14): 12px, 4px radius, 1.4s shimmer, still with `prefers-reduced-motion`. */
export function Skeleton({ width, className, style, ...rest }: SkeletonProps) {
  const mergedStyle: CSSProperties = width === undefined ? { flex: '1 1 0', ...style } : { width: width, ...style };
  return <span className={['fc-skeleton', className].filter(Boolean).join(' ')} style={mergedStyle} aria-hidden="true" {...rest} />;
}

export interface LoadingProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** What the screen reader announces. Default: "Carregando". Be specific: "Carregando execuções". */
  label?: string;
  /** Rows of the default skeleton (bars of 110px, 80px and the rest). Default: 3. Ignored with `children`. */
  rows?: number;
  /** Custom shape, made with `Skeleton`, to mimic the final list. */
  children?: ReactNode;
}

/**
 * Loading skeleton (estilos.md §14), with the shape of the final list. No spinner in the middle of the page.
 * It is a `status` region: the screen reader announces the `label`; the bars are hidden from it.
 */
export function Loading({ label = 'Carregando', rows = 3, className, children, ...rest }: LoadingProps) {
  return (
    <div role="status" aria-live="polite" className={['fc-loading', className].filter(Boolean).join(' ')} {...rest}>
      <span className="fc-visually-hidden">{label}</span>
      <div className="fc-loading-shape" aria-hidden="true">
        {children ??
          Array.from({ length: rows }, (_, index) => (
            <div key={index} className="fc-loading-row">
              <Skeleton width={110} />
              <Skeleton width={80} />
              <Skeleton />
            </div>
          ))}
      </div>
    </div>
  );
}
