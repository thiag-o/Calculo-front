import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Aviso, Botao, CampoTexto, Dialogo, FecharDialogo, type DialogoProps, Texto } from '../../design-system';
import { useCriarChave } from './consultas';
import { IconeCopiar } from './icones';
import { erroNovaChave } from './mensagens';

export const MENSAGEM_COPIA_FALHOU = 'Não foi possível copiar. Selecione a chave e copie com Ctrl C.';
export const AVISO_CHAVE_UMA_VEZ = 'Copie a chave agora: ela não será mostrada de novo.';

const esquema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome'),
});

type DadosNovaChave = z.infer<typeof esquema>;

export interface DialogoNovaChaveProps {
  /** Chamado ao fechar. A chave some junto com o diálogo: monte-o só enquanto aberto. */
  aoFechar: () => void;
  /** Elemento que recebe o foco ao fechar (ver `Dialogo`). */
  focoAoFechar?: DialogoProps['focoAoFechar'];
}

/**
 * "Nova chave de API": pede o nome, cria a chave e a mostra uma única vez, com "Copiar" e o aviso de que não será
 * mostrada de novo. A chave fica só no resultado da mutação deste diálogo (`gcTime: 0`, ADR 0021): fechar desmonta
 * o diálogo e a descarta; ela não vai para o cache de consultas, para estado de fora nem para o armazenamento.
 */
export function DialogoNovaChave({ aoFechar, focoAoFechar }: DialogoNovaChaveProps) {
  const idFormulario = useId();
  const criar = useCriarChave();
  const [copia, setCopia] = useState<'copiado' | 'falhou' | undefined>(undefined);
  const criada = criar.data;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DadosNovaChave>({ resolver: zodResolver(esquema), defaultValues: { nome: '' } });

  const erroApi = criar.error ? erroNovaChave(criar.error) : undefined;

  const enviar = handleSubmit((dados) => {
    if (criar.isPending || criada) return;
    criar.mutate({ nome: dados.nome });
  });

  async function copiar() {
    if (!criada) return;
    try {
      await navigator.clipboard.writeText(criada.chave);
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
      titulo="Nova chave de API"
      descricao={
        criada
          ? `Configure a chave ${criada.nome} no backend do sistema hospedeiro, no cabeçalho Authorization: Chave <chave>.`
          : 'O backend do sistema hospedeiro usa a chave para pedir tokens de incorporação deste tenant.'
      }
      acoes={
        criada ? (
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
            <Botao type="submit" form={idFormulario} variante="principal" carregando={criar.isPending}>
              Salvar
            </Botao>
          </>
        )
      }
    >
      {criada ? (
        <div className="fc-integracao-segredo">
          <Aviso tipo="atencao">{AVISO_CHAVE_UMA_VEZ}</Aviso>
          <CampoTexto
            rotulo="Chave"
            value={criada.chave}
            readOnly
            autoFocus
            autoComplete="off"
            spellCheck={false}
            onFocus={(evento) => evento.currentTarget.select()}
            dica={`Na lista, ela aparece só pelo começo: ${criada.prefixo}…`}
          />
          <Texto como="p" estilo="label-13" tom="secundario" className="fc-integracao-copia" role="status">
            {copia === 'copiado' ? 'Chave copiada' : ''}
          </Texto>
          {copia === 'falhou' ? <Aviso tipo="erro">{MENSAGEM_COPIA_FALHOU}</Aviso> : null}
        </div>
      ) : (
        <form id={idFormulario} className="fc-integracao-formulario" onSubmit={enviar} noValidate>
          <CampoTexto
            rotulo="Nome"
            autoComplete="off"
            dica="Para reconhecer onde a chave é usada, como Portal do cliente. Pode repetir."
            erro={errors.nome?.message ?? erroApi?.campo}
            {...register('nome')}
          />
          {erroApi?.mensagem ? <Aviso tipo="erro">{erroApi.mensagem}</Aviso> : null}
        </form>
      )}
    </Dialogo>
  );
}
