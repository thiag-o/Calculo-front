import { useState } from 'react';
import { ErroApi } from '../../api';
import { Aviso, Botao, CampoTexto, Dialogo, FecharDialogo, Texto, type DialogoProps } from '../../design-system';
import { useGerarLinkRedefinicao, type Usuario } from './consultas';
import { IconeCopiar } from './icones';
import { mensagemErroLink } from './mensagens';

/** Erros em que gerar de novo não adianta: o usuário mudou desde que a lista foi carregada. */
const CODIGOS_SEM_NOVA_TENTATIVA = new Set(['usuario_inativo', 'usuario_externo', 'nao_encontrado']);
const MOTIVO_SEM_NOVA_TENTATIVA = 'Feche e confira o usuário na lista atualizada';

export const MENSAGEM_COPIA_FALHOU = 'Não foi possível copiar. Selecione o link e copie com Ctrl C.';

const formatoValidade = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

/** "Válido até 16/11, 14:30. Funciona uma vez só." no fuso de quem usa. */
export function textoValidade(expiraEm: string): string {
  const quando = new Date(expiraEm);
  const prazo = Number.isNaN(quando.getTime()) ? '' : `Válido até ${formatoValidade.format(quando)}. `;
  return `${prazo}Funciona uma vez só.`;
}

export interface DialogoLinkRedefinicaoProps {
  usuario: Usuario;
  /** Chamado ao fechar. O link some junto com o diálogo: monte-o só enquanto aberto. */
  aoFechar: () => void;
  /** Elemento que recebe o foco ao fechar (ver `Dialogo`). */
  focoAoFechar?: DialogoProps['focoAoFechar'];
}

/**
 * "Gerar link de redefinição": confirma, gera e mostra o link uma única vez, com "Copiar".
 * O link fica só no estado deste diálogo (a mutação sai do cache ao desmontar); fechar o descarta.
 */
export function DialogoLinkRedefinicao({ usuario, aoFechar, focoAoFechar }: DialogoLinkRedefinicaoProps) {
  const gerar = useGerarLinkRedefinicao();
  const [copia, setCopia] = useState<'copiado' | 'falhou' | undefined>(undefined);
  const link = gerar.data;

  const semNovaTentativa = gerar.error instanceof ErroApi && CODIGOS_SEM_NOVA_TENTATIVA.has(gerar.error.codigo);

  async function copiar() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.link);
      setCopia('copiado');
    } catch {
      setCopia('falhou');
    }
  }

  return (
    <Dialogo
      aberto
      focoAoFechar={focoAoFechar}
      aoMudarAberto={(aberto) => {
        if (!aberto) aoFechar();
      }}
      titulo="Link de redefinição"
      descricao={
        link
          ? `Entregue o link a ${usuario.nome} para definir a senha.`
          : `Gera um link de uso único para ${usuario.nome} definir a senha. Um link novo invalida os anteriores.`
      }
      acoes={
        link ? (
          <>
            <FecharDialogo>
              <Botao>Fechar</Botao>
            </FecharDialogo>
            <Botao variante="principal" icone={<IconeCopiar />} onClick={() => void copiar()}>
              Copiar
            </Botao>
          </>
        ) : (
          <>
            <FecharDialogo>
              <Botao>Cancelar</Botao>
            </FecharDialogo>
            <Botao
              variante="principal"
              carregando={gerar.isPending}
              motivoDesabilitado={semNovaTentativa ? MOTIVO_SEM_NOVA_TENTATIVA : undefined}
              onClick={() => gerar.mutate(usuario.id)}
            >
              Gerar link de redefinição
            </Botao>
          </>
        )
      }
    >
      {link ? (
        <div className="fc-usuarios-link">
          <Aviso tipo="atencao">Copie o link agora: ele não será mostrado de novo.</Aviso>
          <CampoTexto
            rotulo="Link"
            value={link.link}
            readOnly
            autoFocus
            spellCheck={false}
            onFocus={(evento) => evento.currentTarget.select()}
            dica={textoValidade(link.expira_em)}
          />
          <Texto como="p" estilo="label-13" tom="secundario" className="fc-usuarios-link-copia" role="status">
            {copia === 'copiado' ? 'Link copiado' : ''}
          </Texto>
          {copia === 'falhou' ? <Aviso tipo="erro">{MENSAGEM_COPIA_FALHOU}</Aviso> : null}
        </div>
      ) : gerar.isError ? (
        <Aviso tipo="erro">{mensagemErroLink(gerar.error)}</Aviso>
      ) : null}
    </Dialogo>
  );
}
