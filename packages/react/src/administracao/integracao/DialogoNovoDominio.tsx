import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Aviso, Botao, CampoTexto, Dialogo, FecharDialogo } from '../../design-system';
import { useCriarDominio } from './consultas';
import { erroNovoDominio } from './mensagens';
import { problemaDaOrigem } from './origem';

const esquema = z.object({
  origem: z
    .string()
    .trim()
    .superRefine((origem, contexto) => {
      const problema = problemaDaOrigem(origem);
      if (problema) contexto.addIssue({ code: 'custom', message: problema });
    }),
});

type DadosNovoDominio = z.infer<typeof esquema>;

export interface DialogoNovoDominioProps {
  /** Chamado ao fechar (Cancelar, Esc, "Fechar" ou depois de salvar). */
  aoFechar: () => void;
}

/**
 * "Novo domínio": cadastra a origem de onde o módulo incorporado pode chamar a API com o token do tenant. A origem é
 * validada no cliente (`https?://host[:porta]`) e de novo pela API, que a guarda normalizada.
 */
export function DialogoNovoDominio({ aoFechar }: DialogoNovoDominioProps) {
  const idFormulario = useId();
  const criar = useCriarDominio();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DadosNovoDominio>({ resolver: zodResolver(esquema), defaultValues: { origem: '' } });

  const erroApi = criar.error ? erroNovoDominio(criar.error) : undefined;

  const enviar = handleSubmit((dados) => {
    if (criar.isPending) return;
    criar.mutate({ origem: dados.origem }, { onSuccess: aoFechar });
  });

  return (
    <Dialogo
      aberto
      aoMudarAberto={(aberto) => {
        if (!aberto) aoFechar();
      }}
      titulo="Novo domínio"
      descricao="Só as origens autorizadas podem usar o módulo incorporado pelo navegador com o token deste tenant."
      acoes={
        <>
          <FecharDialogo>
            <Botao>Cancelar</Botao>
          </FecharDialogo>
          <Botao type="submit" form={idFormulario} variante="principal" carregando={criar.isPending}>
            Salvar
          </Botao>
        </>
      }
    >
      <form id={idFormulario} className="fc-integracao-formulario" onSubmit={enviar} noValidate>
        <CampoTexto
          rotulo="Origem"
          type="url"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="https://app.exemplo.com.br"
          dica="Esquema, host e, se precisar, a porta. Sem caminho no fim."
          erro={errors.origem?.message ?? erroApi?.campo}
          {...register('origem')}
        />
        {erroApi?.mensagem ? <Aviso tipo="erro">{erroApi.mensagem}</Aviso> : null}
      </form>
    </Dialogo>
  );
}
