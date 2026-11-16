import { Aviso, Botao, Dialogo, FecharDialogo } from '../../design-system';
import { erroComCodigo, useRemoverPapel, type Papel } from './consultas';
import { mensagemErroRemocao } from './mensagens';

export const MOTIVO_REMOCAO_EM_USO = 'Tire o papel dos usuários antes de remover';
export const MOTIVO_REMOCAO_NAO_ENCONTRADO = 'O papel não existe mais';
export const MOTIVO_REMOCAO_FIXO = 'O Admin não pode ser removido';

export interface DialogoRemoverPapelProps {
  /** O papel a remover. Nunca o Admin (`fixo`), que não pode ser removido. */
  papel: Papel;
  /** Chamado ao fechar (Cancelar, Esc, "Fechar" ou depois de remover). */
  aoFechar: () => void;
}

/** Confirmação de remover um papel. A ação perigosa fica em vermelho (estilos.md §7.7). */
export function DialogoRemoverPapel({ papel, aoFechar }: DialogoRemoverPapelProps) {
  const remover = useRemoverPapel();
  const erro = remover.error;
  // Depois desses erros, tentar de novo não muda nada: o botão fica desabilitado, com o motivo.
  const motivoDesabilitado = erroComCodigo(erro, ['papel_em_uso'])
    ? MOTIVO_REMOCAO_EM_USO
    : erroComCodigo(erro, ['nao_encontrado'])
      ? MOTIVO_REMOCAO_NAO_ENCONTRADO
      : erroComCodigo(erro, ['papel_fixo'])
        ? MOTIVO_REMOCAO_FIXO
        : undefined;

  return (
    <Dialogo
      aberto
      aoMudarAberto={(aberto) => {
        if (!aberto) aoFechar();
      }}
      titulo="Remover papel"
      descricao={`O papel ${papel.nome} deixa de existir neste tenant. Não dá para desfazer.`}
      acoes={
        <>
          <FecharDialogo>
            <Botao>Cancelar</Botao>
          </FecharDialogo>
          <Botao
            variante="perigo"
            carregando={remover.isPending}
            motivoDesabilitado={motivoDesabilitado}
            onClick={() => remover.mutate(papel.id, { onSuccess: aoFechar })}
          >
            Remover papel
          </Botao>
        </>
      }
    >
      {erro ? <Aviso tipo="erro">{mensagemErroRemocao(erro)}</Aviso> : null}
    </Dialogo>
  );
}
