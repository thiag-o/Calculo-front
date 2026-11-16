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
  classesTexto,
  type DialogoProps,
} from '../../design-system';
import { useAlterarUsuario, useCriarUsuario, usePapeisDisponiveis, type Papel, type Usuario } from './consultas';
import { erroDoFormulario, mensagemErroPapeis } from './mensagens';

const MOTIVO_PAPEIS_CARREGANDO = 'Aguarde a lista de papéis';
const MOTIVO_PAPEIS_COM_ERRO = 'Carregue a lista de papéis para salvar';

function criarEsquema(edicao: boolean) {
  const email = edicao
    ? z.string()
    : z
        .string()
        .trim()
        .min(1, 'Informe o e-mail')
        .pipe(z.email('Informe um e-mail válido, como ana@empresa.com.br'));
  return z.object({
    email,
    nome: z.string().trim().min(1, 'Informe o nome'),
    papeis: z.array(z.string()),
    ativo: z.boolean(),
  });
}

type DadosUsuario = z.infer<ReturnType<typeof criarEsquema>>;

export interface DialogoUsuarioProps {
  /** O usuário a editar. Sem ele, o diálogo cria um usuário novo. */
  usuario?: Usuario;
  /** Chamado ao fechar (Cancelar, Esc, "Fechar" ou depois de salvar). */
  aoFechar: () => void;
  /** Elemento que recebe o foco ao fechar (ver `Dialogo`). */
  focoAoFechar?: DialogoProps['focoAoFechar'];
}

/**
 * Diálogo de criar ou editar um usuário: e-mail (só na criação), nome, papéis e, na edição, se está ativo.
 * Monte-o só enquanto aberto: cada abertura começa do zero.
 */
export function DialogoUsuario({ usuario, aoFechar, focoAoFechar }: DialogoUsuarioProps) {
  const edicao = usuario !== undefined;
  const idFormulario = useId();
  const idErroPapeis = useId();
  const papeis = usePapeisDisponiveis(true);
  const criar = useCriarUsuario();
  const alterar = useAlterarUsuario();
  const mutacao = edicao ? alterar : criar;

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<DadosUsuario>({
    resolver: zodResolver(criarEsquema(edicao)),
    defaultValues: {
      email: usuario?.email ?? '',
      nome: usuario?.nome ?? '',
      papeis: usuario?.papeis.map((papel) => papel.id) ?? [],
      ativo: usuario?.ativo ?? true,
    },
  });

  const erroApi = mutacao.error ? erroDoFormulario(mutacao.error) : undefined;
  const erroPapeis = errors.papeis?.message ?? erroApi?.campos.papeis;

  const motivoDesabilitado = papeis.isPending ? MOTIVO_PAPEIS_CARREGANDO : papeis.isError ? MOTIVO_PAPEIS_COM_ERRO : undefined;

  const enviar = handleSubmit((dados) => {
    if (motivoDesabilitado) return;
    if (usuario) {
      alterar.mutate(
        { id: usuario.id, corpo: { nome: dados.nome, papeis: dados.papeis, ativo: dados.ativo } },
        { onSuccess: aoFechar },
      );
    } else {
      criar.mutate({ email: dados.email, nome: dados.nome, papeis: dados.papeis }, { onSuccess: aoFechar });
    }
  });

  return (
    <Dialogo
      aberto
      focoAoFechar={focoAoFechar}
      aoMudarAberto={(aberto) => {
        if (!aberto) aoFechar();
      }}
      titulo={edicao ? 'Editar usuário' : 'Novo usuário'}
      descricao={edicao ? usuario.email : 'A pessoa recebe acesso a este tenant com os papéis escolhidos.'}
      acoes={
        <>
          <FecharDialogo>
            <Botao>Cancelar</Botao>
          </FecharDialogo>
          <Botao
            type="submit"
            form={idFormulario}
            variante="principal"
            carregando={mutacao.isPending}
            motivoDesabilitado={motivoDesabilitado}
          >
            Salvar
          </Botao>
        </>
      }
    >
      <form id={idFormulario} className="fc-usuarios-formulario" onSubmit={enviar} noValidate>
        {edicao ? null : (
          <CampoTexto
            rotulo="E-mail"
            type="email"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            erro={errors.email?.message ?? erroApi?.campos.email}
            {...register('email')}
          />
        )}
        <CampoTexto
          rotulo="Nome"
          autoComplete="off"
          dica={
            edicao ? 'O nome vale em todos os tenants do usuário.' : 'Se o e-mail já tem acesso a outro tenant, o nome dele não muda.'
          }
          erro={errors.nome?.message ?? erroApi?.campos.nome}
          {...register('nome')}
        />
        <fieldset className="fc-usuarios-papeis" aria-describedby={erroPapeis ? idErroPapeis : undefined}>
          <legend className={`fc-usuarios-papeis-legenda ${classesTexto({ estilo: 'label-13', tom: 'secundario' })}`}>Papéis</legend>
          {papeis.isPending ? (
            <Carregando rotulo="Carregando papéis" linhas={3} />
          ) : papeis.isError ? (
            <Aviso
              tipo="erro"
              acoes={
                <Botao tamanho="pequeno" onClick={() => void papeis.refetch()} carregando={papeis.isFetching}>
                  Tentar de novo
                </Botao>
              }
            >
              {mensagemErroPapeis(papeis.error)}
            </Aviso>
          ) : papeis.data.length === 0 ? (
            <p className={`fc-usuarios-sem-papeis ${classesTexto({ estilo: 'label-13', tom: 'secundario' })}`}>
              Nenhum papel no tenant. Crie um papel para dar acesso.
            </p>
          ) : (
            <Controller
              control={control}
              name="papeis"
              render={({ field }) => (
                <div className="fc-usuarios-papeis-lista">
                  {papeis.data.map((papel) => (
                    <CaixaPapel
                      key={papel.id}
                      papel={papel}
                      marcado={field.value.includes(papel.id)}
                      aoMudar={(marcado) =>
                        field.onChange(marcado ? [...field.value, papel.id] : field.value.filter((id) => id !== papel.id))
                      }
                    />
                  ))}
                </div>
              )}
            />
          )}
          {erroPapeis ? (
            <MensagemCampo id={idErroPapeis} tipo="erro">
              {erroPapeis}
            </MensagemCampo>
          ) : null}
        </fieldset>
        {edicao ? (
          <Controller
            control={control}
            name="ativo"
            render={({ field }) => (
              <CaixaSelecao
                rotulo="Ativo neste tenant"
                dica="Desativar encerra as sessões do usuário neste tenant."
                checked={field.value}
                onCheckedChange={(valor) => field.onChange(valor === true)}
                erro={erroApi?.campos.ativo}
              />
            )}
          />
        ) : null}
        {erroApi?.mensagem ? <Aviso tipo="erro">{erroApi.mensagem}</Aviso> : null}
      </form>
    </Dialogo>
  );
}

function CaixaPapel({ papel, marcado, aoMudar }: { papel: Papel; marcado: boolean; aoMudar: (marcado: boolean) => void }) {
  return (
    <CaixaSelecao
      rotulo={papel.nome}
      dica={papel.fixo ? 'Todas as permissões. O tenant precisa de pelo menos um Admin ativo.' : undefined}
      checked={marcado}
      onCheckedChange={(valor) => aoMudar(valor === true)}
    />
  );
}
