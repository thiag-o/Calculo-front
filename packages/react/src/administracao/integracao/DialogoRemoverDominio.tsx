import { Aviso, Botao, Dialogo, FecharDialogo, type DialogoProps } from '../../design-system';
import { erroComCodigo, useRemoverDominio, type DominioAutorizado } from './consultas';
import { mensagemErroRemocao } from './mensagens';

export const MOTIVO_REMOCAO_NAO_ENCONTRADO = 'O domínio já foi removido';

export interface DialogoRemoverDominioProps {
  dominio: DominioAutorizado;
  /** Chamado ao fechar (Cancelar, Esc, "Fechar" ou depois de remover). */
  aoFechar: () => void;
  /** Elemento que recebe o foco ao fechar (ver `Dialogo`). */
  focoAoFechar?: DialogoProps['focoAoFechar'];
}

/** Confirmação de remover um domínio autorizado. A ação perigosa fica em vermelho (estilos.md §7.7). */
export function DialogoRemoverDominio({ dominio, aoFechar, focoAoFechar }: DialogoRemoverDominioProps) {
  const remover = useRemoverDominio();
  const erro = remover.error;
  const motivoDesabilitado = erroComCodigo(erro, ['nao_encontrado']) ? MOTIVO_REMOCAO_NAO_ENCONTRADO : undefined;

  return (
    <Dialogo
      aberto
      focoAoFechar={focoAoFechar}
      aoMudarAberto={(aberto) => {
        if (!aberto) aoFechar();
      }}
      titulo="Remover domínio"
      descricao={`${dominio.origem} deixa de poder chamar a API com o token deste tenant: o módulo incorporado nessa origem para de funcionar.`}
      acoes={
        <>
          <FecharDialogo>
            <Botao>Cancelar</Botao>
          </FecharDialogo>
          <Botao
            variante="perigo"
            carregando={remover.isPending}
            motivoDesabilitado={motivoDesabilitado}
            onClick={() => remover.mutate(dominio.id, { onSuccess: aoFechar })}
          >
            Remover domínio
          </Botao>
        </>
      }
    >
      {erro ? <Aviso tipo="erro">{mensagemErroRemocao(erro)}</Aviso> : null}
    </Dialogo>
  );
}
