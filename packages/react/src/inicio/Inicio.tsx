import { Botao, Caixa, EstadoVazio, Texto } from '../design-system';
import './inicio.css';

const MOTIVO_WORKFLOWS = 'Disponível quando os workflows chegarem ao módulo';
const MOTIVO_EXECUCOES = 'Disponível quando houver um workflow publicado';

/**
 * Tela Início (estilos.md §16): "Precisa de você", "Workflows recentes" e "Execuções recentes".
 * Ainda sem dados: cada seção mostra o estado vazio desenhado (§14). Os dados entram nos épicos seguintes.
 */
export function Inicio() {
  return (
    <div className="fc-inicio">
      <header className="fc-inicio-topo">
        <div className="fc-inicio-titulo">
          <Texto como="h1" estilo="heading-24">
            Início
          </Texto>
          <Texto como="p" estilo="label-14" tom="secundario">
            Nenhum workflow ainda
          </Texto>
        </div>
        <Botao variante="principal" motivoDesabilitado={MOTIVO_WORKFLOWS} exibirMotivo="ao-lado">
          Novo workflow
        </Botao>
      </header>

      <section className="fc-inicio-secao" aria-labelledby="fc-inicio-precisa">
        <Texto como="h2" estilo="heading-16" id="fc-inicio-precisa">
          Precisa de você
        </Texto>
        <Caixa como="div">
          <EstadoVazio
            titulo="Nada precisa de você agora"
            descricao="Aprovações, execuções com erro e alertas aparecem aqui, do mais urgente."
          />
        </Caixa>
      </section>

      <section className="fc-inicio-secao" aria-labelledby="fc-inicio-workflows">
        <Texto como="h2" estilo="heading-16" id="fc-inicio-workflows">
          Workflows recentes
        </Texto>
        <Caixa como="div">
          <EstadoVazio
            titulo="Nenhum workflow ainda"
            descricao="Crie o primeiro workflow para começar a calcular."
            acao={
              <Botao tamanho="pequeno" motivoDesabilitado={MOTIVO_WORKFLOWS} exibirMotivo="ao-lado">
                Novo workflow
              </Botao>
            }
          />
        </Caixa>
      </section>

      <section className="fc-inicio-secao" aria-labelledby="fc-inicio-execucoes">
        <Texto como="h2" estilo="heading-16" id="fc-inicio-execucoes">
          Execuções recentes
        </Texto>
        <Caixa como="div">
          <EstadoVazio
            titulo="Nenhuma execução ainda"
            descricao="Publique uma versão e execute o primeiro lote."
            acao={
              <Botao tamanho="pequeno" motivoDesabilitado={MOTIVO_EXECUCOES} exibirMotivo="ao-lado">
                Executar lote
              </Botao>
            }
          />
        </Caixa>
      </section>
    </div>
  );
}
