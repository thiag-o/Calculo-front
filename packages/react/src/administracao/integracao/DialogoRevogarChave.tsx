import { Aviso, Botao, Dialogo, FecharDialogo } from '../../design-system';
import { erroComCodigo, useRevogarChave, type ChaveApi } from './consultas';
import { mensagemErroRevogacao } from './mensagens';

export const MOTIVO_REVOGACAO_NAO_ENCONTRADA = 'A chave não existe mais';

export interface DialogoRevogarChaveProps {
  /** A chave a revogar (ainda ativa). */
  chave: ChaveApi;
  /** Chamado ao fechar (Cancelar, Esc, "Fechar" ou depois de revogar). */
  aoFechar: () => void;
}

/** Confirmação de revogar uma chave de API. A ação perigosa fica em vermelho (estilos.md §7.7). */
export function DialogoRevogarChave({ chave, aoFechar }: DialogoRevogarChaveProps) {
  const revogar = useRevogarChave();
  const erro = revogar.error;
  // Depois desse erro, tentar de novo não muda nada: o botão fica desabilitado, com o motivo.
  const motivoDesabilitado = erroComCodigo(erro, ['nao_encontrado']) ? MOTIVO_REVOGACAO_NAO_ENCONTRADA : undefined;

  return (
    <Dialogo
      aberto
      aoMudarAberto={(aberto) => {
        if (!aberto) aoFechar();
      }}
      titulo="Revogar chave"
      descricao={`A chave ${chave.nome} (${chave.prefixo}…) para de funcionar: o sistema que a usa não consegue mais pedir tokens de incorporação. Não dá para desfazer.`}
      acoes={
        <>
          <FecharDialogo>
            <Botao>Cancelar</Botao>
          </FecharDialogo>
          <Botao
            variante="perigo"
            carregando={revogar.isPending}
            motivoDesabilitado={motivoDesabilitado}
            onClick={() => revogar.mutate(chave.id, { onSuccess: aoFechar })}
          >
            Revogar chave
          </Botao>
        </>
      }
    >
      {erro ? <Aviso tipo="erro">{mensagemErroRevogacao(erro)}</Aviso> : null}
    </Dialogo>
  );
}
