import { ErroApi } from '../api';
import { Aviso, Botao, Caixa, Carregando, EstadoVazio } from '../design-system';
import { IconeSair, IconeSeguranca } from './icones';

/** O que está abrindo, com o artigo: o módulo inteiro ou uma tela avulsa (ex.: `a Auditoria`). */
const O_MODULO = 'o Fluxo de Cálculo';

/** Enquanto a sessão chega: esqueleto, sem spinner no meio da página (estilos.md §14). */
export function CarregandoModulo({ alvo = O_MODULO }: { alvo?: string }) {
  return (
    <div className="fc-modulo-pagina">
      <Carregando rotulo={`Carregando ${alvo}`} linhas={4} />
    </div>
  );
}

export interface ErroModuloProps {
  erro: Error;
  tentando: boolean;
  aoTentarDeNovo: () => void;
  /** O que não abriu, com o artigo. Padrão: `o Fluxo de Cálculo`. */
  alvo?: string;
}

/** A sessão não carregou por um motivo passageiro (rede, servidor): diz o que houve e oferece tentar de novo. */
export function ErroModulo({ erro, tentando, aoTentarDeNovo, alvo = O_MODULO }: ErroModuloProps) {
  const detalhe = erro instanceof ErroApi ? erro.mensagem : 'Tente de novo em instantes.';
  return (
    <div className="fc-modulo-pagina">
      <Aviso
        tipo="erro"
        titulo={`Não foi possível abrir ${alvo}`}
        acoes={
          <Botao tamanho="pequeno" carregando={tentando} onClick={aoTentarDeNovo}>
            Tentar de novo
          </Botao>
        }
      >
        {detalhe}
      </Aviso>
    </div>
  );
}

/** Sem sessão (expirou, foi revogada ou a pessoa saiu). O hospedeiro já foi avisado pelo `onSessaoExpirada`. */
export function SessaoEncerrada() {
  return (
    <div className="fc-modulo-pagina">
      <Caixa como="div">
        <EstadoVazio icone={<IconeSair />} titulo="A sessão terminou" descricao="Entre de novo para continuar." />
      </Caixa>
    </div>
  );
}

/** O usuário não pode ver nenhuma tela neste cliente. */
export function SemTelas() {
  return (
    <div className="fc-modulo-pagina">
      <Caixa como="div">
        <EstadoVazio
          titulo="Nenhuma tela disponível para você"
          descricao="Peça ao administrador do cliente as permissões de que precisa."
        />
      </Caixa>
    </div>
  );
}

/**
 * Sem acesso a uma tela avulsa: falta a permissão dela no cliente atual. Estado vazio (estilos.md §7.7 e §14), sem
 * ação, porque só o administrador do cliente resolve.
 */
export function SemAcesso({ titulo }: { titulo: string }) {
  return (
    <div className="fc-modulo-pagina">
      <Caixa como="div">
        <EstadoVazio
          icone={<IconeSeguranca />}
          titulo={titulo}
          descricao="Peça ao administrador do cliente as permissões de que precisa."
        />
      </Caixa>
    </div>
  );
}
