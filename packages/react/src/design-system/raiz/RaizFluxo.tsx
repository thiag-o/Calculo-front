import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import { useState, type ReactNode } from 'react';
import '../tokens/tokens.css';
import '../tipografia/tipografia.css';
import { ContextoPortal } from './portal';
import './raiz.css';

/** Tema do módulo. `sistema` segue o `prefers-color-scheme` do sistema operacional. */
export type TemaFluxo = 'claro' | 'escuro' | 'sistema';

const atributoDoTema: Record<TemaFluxo, 'light' | 'dark' | undefined> = {
  claro: 'light',
  escuro: 'dark',
  sistema: undefined,
};

export interface RaizFluxoProps {
  /** Padrão: `sistema`. */
  tema?: TemaFluxo;
  /** Classes extras do hospedeiro ou do layout, somadas a `fc-raiz`. */
  className?: string;
  children?: ReactNode;
}

// Geist e Geist Mono empacotadas localmente (resposta G7: fontes locais, sem CDN). São importação externa no build
// do pacote (vite.config.ts): o bundler do hospedeiro empacota os .woff2 e o navegador só baixa os subconjuntos usados
// (unicode-range). Ficam aqui, num módulo usado, porque o `sideEffects` do package.json (só CSS) faria o build
// descartar um módulo que só tivesse estas importações. O @font-face não é seletor: não estiliza o hospedeiro.

/**
 * Raiz do módulo: escopo dos tokens --fc-* e da tipografia, tema por `data-theme`
 * e contêiner dos portais (Radix) dentro do próprio módulo, nunca no `body` (ADR 0002).
 */
export function RaizFluxo({ tema = 'sistema', className, children }: RaizFluxoProps) {
  const [portal, setPortal] = useState<HTMLDivElement | null>(null);
  const classes = className ? `fc-raiz ${className}` : 'fc-raiz';

  return (
    <div className={classes} data-theme={atributoDoTema[tema]}>
      <ContextoPortal.Provider value={portal}>
        {children}
        <div ref={setPortal} className="fc-portais" data-fc-portais="" />
      </ContextoPortal.Provider>
    </div>
  );
}
