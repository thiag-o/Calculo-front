import { useId, useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { Aviso, Botao, Dica } from '../../design-system';
import type { Sessao } from '../../sessao';
import { IconeExpandirMenu, IconeRecolherMenu } from '../icones';
import type { DefinicaoTela } from '../telas';
import { mensagemErroSair, mensagemErroTroca } from './mensagens';
import { MenuUsuario } from './MenuUsuario';
import { SeletorCliente } from './SeletorCliente';
import { useLarguraEstreita } from './useLarguraEstreita';
import './casca.css';

export interface LayoutCascaProps {
  sessao: Sessao;
  /** Só as telas que o usuário pode ver no tenant atual. */
  telas: readonly DefinicaoTela[];
}

/**
 * Layout do app casca (design.md §15, estilos.md §9 e §15): menu lateral único de 240px, com o seletor de cliente no
 * topo, os itens por permissão e quem está logado no rodapé. O menu pode ser recolhido e fica só com ícones (64px,
 * nome na dica) quando o módulo tem menos de 1180px.
 */
export function LayoutCasca({ sessao, telas }: LayoutCascaProps) {
  const referencia = useRef<HTMLDivElement>(null);
  const estreito = useLarguraEstreita(referencia);
  const [recolhido, setRecolhido] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const idNavegacao = useId();
  const compacto = estreito || recolhido;

  const classes = ['fc-casca', compacto ? 'fc-casca-compacto' : null, estreito ? 'fc-casca-estreito' : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={referencia} className={classes}>
      <aside className="fc-menu-lateral" aria-label="Menu lateral">
        <div className="fc-menu-lateral-topo">
          <SeletorCliente
            sessao={sessao}
            aoTrocar={() => setAviso(null)}
            aoFalhar={(erro) => setAviso(mensagemErroTroca(erro))}
          />
        </div>

        <nav id={idNavegacao} className="fc-menu-lateral-nav" aria-label="Navegação principal">
          {telas.map((tela) => (
            <ItemMenuLateral key={tela.id} tela={tela} compacto={compacto} />
          ))}
        </nav>

        <div className="fc-menu-lateral-rodape">
          <MenuUsuario usuario={sessao.usuario} aoFalhar={(erro) => setAviso(mensagemErroSair(erro))} />
          {/* Abaixo de 1180px o menu fica só com ícones de qualquer jeito: não há o que expandir. */}
          {estreito ? null : (
            <Botao
              soIcone
              variante="fantasma"
              tamanho="pequeno"
              className="fc-menu-lateral-alternar"
              rotulo={recolhido ? 'Expandir menu' : 'Recolher menu'}
              icone={recolhido ? <IconeExpandirMenu /> : <IconeRecolherMenu />}
              aria-expanded={!recolhido}
              aria-controls={idNavegacao}
              onClick={() => setRecolhido((atual) => !atual)}
            />
          )}
        </div>
      </aside>

      <main className="fc-modulo-conteudo">
        <div className="fc-modulo-pagina">
          {aviso ? (
            <Aviso
              tipo="erro"
              acoes={
                <Botao tamanho="pequeno" onClick={() => setAviso(null)}>
                  Fechar aviso
                </Botao>
              }
            >
              {aviso}
            </Aviso>
          ) : null}
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function ItemMenuLateral({ tela, compacto }: { tela: DefinicaoTela; compacto: boolean }) {
  const link = (
    <NavLink to={`/${tela.caminho}`} className="fc-menu-lateral-item">
      <span className="fc-menu-lateral-item-icone" aria-hidden="true">
        {tela.icone}
      </span>
      <span className="fc-menu-lateral-item-rotulo">{tela.rotulo}</span>
    </NavLink>
  );
  // Só com ícones, o nome aparece na dica (estilos.md §15); o rótulo continua no link para o leitor de tela.
  return compacto ? (
    <Dica conteudo={tela.rotulo} lado="direita">
      {link}
    </Dica>
  ) : (
    link
  );
}
