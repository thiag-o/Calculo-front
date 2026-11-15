import { NavLink, Outlet } from 'react-router';
import type { DefinicaoTela } from '../telas';
import './incorporado.css';

export interface LayoutIncorporadoProps {
  /** Só as telas que o usuário pode ver. */
  telas: readonly DefinicaoTela[];
}

/**
 * Layout incorporado (design.md §15, estilos.md §9 e §15): sem menu lateral nem topo próprios, só as abas internas
 * e o conteúdo. A largura é a que o hospedeiro der; o tema vem das variáveis --fc-*.
 * O conteúdo é uma região nomeada, não um `main`: a página do hospedeiro já tem o dela.
 */
export function LayoutIncorporado({ telas }: LayoutIncorporadoProps) {
  return (
    <div className="fc-incorporado">
      <div className="fc-abas">
        <nav className="fc-abas-lista" aria-label="Telas do Fluxo de Cálculo">
          {telas.map((tela) => (
            <NavLink key={tela.id} to={`/${tela.caminho}`} className="fc-aba">
              {tela.rotulo}
            </NavLink>
          ))}
        </nav>
      </div>
      <section className="fc-modulo-conteudo" aria-label="Fluxo de Cálculo">
        <div className="fc-modulo-pagina">
          <Outlet />
        </div>
      </section>
    </div>
  );
}
