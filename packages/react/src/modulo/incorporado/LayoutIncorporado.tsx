import { NavLink, Outlet } from 'react-router';
import { agruparPorSecao, type DefinicaoTela } from '../telas';
import './incorporado.css';

export interface LayoutIncorporadoProps {
  /** Só as telas que o usuário pode ver. */
  telas: readonly DefinicaoTela[];
}

/**
 * Layout incorporado (design.md §15, estilos.md §9 e §15): sem menu lateral nem topo próprios, só as abas internas
 * e o conteúdo. A largura é a que o hospedeiro der; o tema vem das variáveis --fc-*.
 * As abas são os itens do menu lateral do casca: cada tela solta é uma aba, e cada seção (ex.: Administração) é uma
 * aba só, que abre a primeira tela permitida dela e fica ativa em qualquer tela da seção. Uma seção sem telas
 * permitidas não tem aba.
 * O conteúdo é uma região nomeada, não um `main`: a página do hospedeiro já tem o dela.
 */
export function LayoutIncorporado({ telas }: LayoutIncorporadoProps) {
  const { soltas, secoes } = agruparPorSecao(telas);
  const abas = [
    ...soltas.map((tela) => ({ chave: tela.id, rotulo: tela.rotulo, caminho: tela.caminho })),
    ...secoes.map((grupo) => ({ chave: `secao-${grupo.secao}`, rotulo: grupo.rotulo, caminho: grupo.caminho })),
  ];
  return (
    <div className="fc-incorporado">
      <div className="fc-abas">
        <nav className="fc-abas-lista" aria-label="Telas do Fluxo de Cálculo">
          {abas.map((aba) => (
            <NavLink key={aba.chave} to={`/${aba.caminho}`} className="fc-aba">
              {aba.rotulo}
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
