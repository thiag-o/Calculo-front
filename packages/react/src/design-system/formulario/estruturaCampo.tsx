import { useId, type ReactNode } from 'react';
import { MensagemCampo } from './MensagemCampo';

/** Props comuns a todo campo do design-system. */
export interface PropsCampo {
  /** Rótulo visível acima do campo (ou ao lado, na caixa de seleção). Obrigatório: é o nome acessível. */
  rotulo: ReactNode;
  /** Ajuda abaixo do campo ("Mínimo de 12 caracteres"). */
  dica?: ReactNode;
  /** Erro do campo: o que houve e o que fazer. Marca o campo como inválido. */
  erro?: ReactNode;
}

interface IdsCampo {
  id: string;
  idDica?: string;
  idErro?: string;
  /** Erro primeiro: é o que o leitor de tela deve dizer antes da ajuda. */
  descritoPor?: string;
  invalido: boolean;
}

/** Ids do campo e das mensagens, e o aria-describedby que os liga. */
export function useIdsCampo(idExterno: string | undefined, dica: ReactNode, erro: ReactNode, descritoPorExterno?: string): IdsCampo {
  const gerado = useId();
  const id = idExterno ?? `fc-campo-${gerado}`;
  const idDica = temConteudo(dica) ? `${id}-dica` : undefined;
  const idErro = temConteudo(erro) ? `${id}-erro` : undefined;
  const descritoPor = [idErro, idDica, descritoPorExterno].filter(Boolean).join(' ') || undefined;
  return { id, idDica, idErro, descritoPor, invalido: idErro !== undefined };
}

export function MensagensCampo({ ids, dica, erro }: { ids: IdsCampo; dica: ReactNode; erro: ReactNode }) {
  return (
    <>
      {ids.idDica ? (
        <MensagemCampo id={ids.idDica} tipo="dica">
          {dica}
        </MensagemCampo>
      ) : null}
      {ids.idErro ? (
        <MensagemCampo id={ids.idErro} tipo="erro">
          {erro}
        </MensagemCampo>
      ) : null}
    </>
  );
}

function temConteudo(valor: ReactNode): boolean {
  return valor !== undefined && valor !== null && valor !== false && valor !== '';
}

export function juntarClasses(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
