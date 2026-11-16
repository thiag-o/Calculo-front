import { Aviso, Botao, Dialogo, FecharDialogo, classesTexto } from '../../design-system';
import type { ConfiguracaoSeguranca } from './consultas';
import { PARAMETROS, quantidade, type CampoSeguranca } from './parametros';

export interface DialogoSalvarSegurancaProps {
  /** Os valores em vigor, para mostrar "de … para …". */
  configuracao: ConfiguracaoSeguranca;
  /** Os valores novos (só os alterados importam), já validados. */
  novos: Readonly<Record<CampoSeguranca, number>>;
  /** Os campos alterados, na ordem da tela. */
  alterados: readonly CampoSeguranca[];
  /** O PUT está em andamento. */
  salvando: boolean;
  /** Erro do PUT que não é de campo (permissão, CSRF, rede…), mostrado aqui para tentar de novo. */
  erro?: string;
  aoConfirmar: () => void;
  /** Chamado ao fechar (Cancelar, Esc ou "Fechar"). */
  aoFechar: () => void;
}

/** Confirmação antes de salvar: lista cada parâmetro alterado, com o valor em vigor e o novo. */
export function DialogoSalvarSeguranca({ configuracao, novos, alterados, salvando, erro, aoConfirmar, aoFechar }: DialogoSalvarSegurancaProps) {
  const parametros = PARAMETROS.filter((parametro) => alterados.includes(parametro.campo));
  return (
    <Dialogo
      aberto
      aoMudarAberto={(aberto) => {
        if (!aberto) aoFechar();
      }}
      titulo="Salvar parâmetros de segurança"
      descricao="Os novos valores valem para todo o tenant. A alteração fica registrada na auditoria."
      acoes={
        <>
          <FecharDialogo>
            <Botao>Cancelar</Botao>
          </FecharDialogo>
          <Botao variante="principal" carregando={salvando} onClick={aoConfirmar}>
            Salvar
          </Botao>
        </>
      }
    >
      <ul className="fc-seguranca-alteracoes" aria-label="Parâmetros alterados">
        {parametros.map((parametro) => (
          <li key={parametro.campo} className="fc-seguranca-alteracao">
            <span className={classesTexto({ estilo: 'label-14', medio: true })}>{parametro.rotulo}</span>
            <span className={`fc-seguranca-numero ${classesTexto({ estilo: 'label-13', tom: 'secundario' })}`}>
              de {quantidade(configuracao[parametro.campo].valor, parametro)} para {quantidade(novos[parametro.campo], parametro)}
            </span>
          </li>
        ))}
      </ul>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
    </Dialogo>
  );
}
