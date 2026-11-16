import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Aviso,
  Botao,
  CaixaSelecao,
  CampoTexto,
  Carregando,
  Dialogo,
  FecharDialogo,
  MensagemCampo,
  Selo,
  classesTexto,
} from '../../design-system';
import {
  agruparPermissoes,
  useAlterarPapel,
  useCatalogoPermissoes,
  useCriarPapel,
  type CodigoPermissao,
  type Papel,
  type Permissao,
} from './consultas';
import { erroDoFormulario, mensagemErroConsulta } from './mensagens';

export const MOTIVO_CATALOGO_CARREGANDO = 'Aguarde o catálogo de permissões';
export const MOTIVO_CATALOGO_COM_ERRO = 'Carregue o catálogo de permissões para salvar';

const esquema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome do papel'),
  permissoes: z.array(z.string()),
});

type DadosFormulario = z.infer<typeof esquema>;

export interface DialogoPapelProps {
  /** O papel a editar. Sem ele, o diálogo cria um papel novo. Nunca o Admin (`fixo`), que não é editável. */
  papel?: Papel;
  /** Chamado ao fechar (Cancelar, Esc, "Fechar" ou depois de salvar). */
  aoFechar: () => void;
}

/**
 * Diálogo de criar ou editar um papel: nome e permissões, escolhidas no catálogo agrupado, com as sensíveis
 * destacadas. Monte-o só enquanto aberto: cada abertura começa do zero.
 */
export function DialogoPapel({ papel, aoFechar }: DialogoPapelProps) {
  const edicao = papel !== undefined;
  const idFormulario = useId();
  const idPermissoes = useId();
  const idAjuda = useId();
  const idErroPermissoes = useId();
  const catalogo = useCatalogoPermissoes(true);
  const criar = useCriarPapel();
  const alterar = useAlterarPapel();
  const mutacao = edicao ? alterar : criar;

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<DadosFormulario>({
    resolver: zodResolver(esquema),
    defaultValues: { nome: papel?.nome ?? '', permissoes: papel?.permissoes ?? [] },
  });

  const erroApi = mutacao.error ? erroDoFormulario(mutacao.error) : undefined;
  const erroPermissoes = errors.permissoes?.message ?? erroApi?.campos.permissoes;
  const motivoDesabilitado = catalogo.isPending ? MOTIVO_CATALOGO_CARREGANDO : catalogo.isError ? MOTIVO_CATALOGO_COM_ERRO : undefined;
  const temSensiveis = catalogo.data?.some((permissao) => permissao.sensivel) ?? false;

  const enviar = handleSubmit((dados) => {
    if (motivoDesabilitado) return;
    const corpo = { nome: dados.nome, permissoes: dados.permissoes as CodigoPermissao[] };
    if (papel) alterar.mutate({ id: papel.id, corpo }, { onSuccess: aoFechar });
    else criar.mutate(corpo, { onSuccess: aoFechar });
  });

  const descritoPor = [temSensiveis ? idAjuda : undefined, erroPermissoes ? idErroPermissoes : undefined].filter(Boolean).join(' ');

  return (
    <Dialogo
      aberto
      aoMudarAberto={(aberto) => {
        if (!aberto) aoFechar();
      }}
      className="fc-papeis-dialogo"
      titulo={edicao ? 'Editar papel' : 'Novo papel'}
      descricao={
        edicao
          ? 'As permissões valem para todos os usuários com este papel.'
          : 'Um papel é um conjunto de permissões. Depois, dê o papel aos usuários em Usuários.'
      }
      acoes={
        <>
          <FecharDialogo>
            <Botao>Cancelar</Botao>
          </FecharDialogo>
          <Botao type="submit" form={idFormulario} variante="principal" carregando={mutacao.isPending} motivoDesabilitado={motivoDesabilitado}>
            Salvar
          </Botao>
        </>
      }
    >
      <form id={idFormulario} className="fc-papeis-formulario" onSubmit={enviar} noValidate>
        <CampoTexto rotulo="Nome" autoComplete="off" erro={errors.nome?.message ?? erroApi?.campos.nome} {...register('nome')} />

        <div
          role="group"
          className="fc-papeis-catalogo"
          aria-labelledby={idPermissoes}
          aria-describedby={descritoPor || undefined}
        >
          <Controller
            control={control}
            name="permissoes"
            render={({ field }) => (
              <>
                <div className="fc-papeis-catalogo-topo">
                  <span id={idPermissoes} className={classesTexto({ estilo: 'label-13', tom: 'secundario' })}>
                    Permissões
                  </span>
                  {catalogo.data ? (
                    <span className={`fc-papeis-numero ${classesTexto({ estilo: 'label-12', tom: 'secundario' })}`}>
                      {field.value.length} de {catalogo.data.length} marcadas
                    </span>
                  ) : null}
                </div>
                {temSensiveis ? (
                  <p id={idAjuda} className={`fc-papeis-ajuda ${classesTexto({ estilo: 'label-12', tom: 'secundario' })}`}>
                    As permissões marcadas como <Selo cor="ambar">Sensível</Selo> dão acesso a credenciais, aprovações e
                    ajustes. Dê uma a uma, só a quem precisa.
                  </p>
                ) : null}
                {catalogo.isPending ? (
                  <Carregando rotulo="Carregando o catálogo de permissões" linhas={4} />
                ) : catalogo.isError ? (
                  <Aviso
                    tipo="erro"
                    titulo="Não foi possível carregar o catálogo de permissões"
                    acoes={
                      <Botao tamanho="pequeno" onClick={() => void catalogo.refetch()} carregando={catalogo.isFetching}>
                        Tentar de novo
                      </Botao>
                    }
                  >
                    {mensagemErroConsulta(catalogo.error)}
                  </Aviso>
                ) : catalogo.data.length === 0 ? (
                  <p className={`fc-papeis-sem-permissoes ${classesTexto({ estilo: 'label-13', tom: 'secundario' })}`}>
                    O catálogo de permissões está vazio. Fale com quem opera o sistema.
                  </p>
                ) : (
                  agruparPermissoes(catalogo.data).map(({ grupo, permissoes }) => (
                    <fieldset key={grupo} className="fc-papeis-grupo">
                      <legend className={`fc-papeis-grupo-legenda ${classesTexto({ estilo: 'label-14', medio: true })}`}>{grupo}</legend>
                      {permissoes.map((permissao) => (
                        <CaixaPermissao
                          key={permissao.codigo}
                          permissao={permissao}
                          marcada={field.value.includes(permissao.codigo)}
                          aoMudar={(marcada) =>
                            field.onChange(
                              marcada ? [...field.value, permissao.codigo] : field.value.filter((codigo) => codigo !== permissao.codigo),
                            )
                          }
                        />
                      ))}
                    </fieldset>
                  ))
                )}
              </>
            )}
          />
          {erroPermissoes ? (
            <MensagemCampo id={idErroPermissoes} tipo="erro">
              {erroPermissoes}
            </MensagemCampo>
          ) : null}
        </div>

        {erroApi?.mensagem ? <Aviso tipo="erro">{erroApi.mensagem}</Aviso> : null}
      </form>
    </Dialogo>
  );
}

function CaixaPermissao({ permissao, marcada, aoMudar }: { permissao: Permissao; marcada: boolean; aoMudar: (marcada: boolean) => void }) {
  return (
    <CaixaSelecao
      rotulo={
        <span className="fc-papeis-permissao">
          {permissao.nome}
          {/* O espaço separa as palavras no nome acessível ("Aprovar versões Sensível"); o flex o descarta na tela. */}
          {permissao.sensivel ? <> <Selo cor="ambar">Sensível</Selo></> : null}
        </span>
      }
      checked={marcada}
      onCheckedChange={(valor) => aoMudar(valor === true)}
    />
  );
}
