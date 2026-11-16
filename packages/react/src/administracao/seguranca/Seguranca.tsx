import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ErroApi } from '../../api';
import { Aviso, Botao, Caixa, CampoTexto, Carregando, Esqueleto, Texto, classesTexto } from '../../design-system';
import { useAlterarConfiguracaoSeguranca, useConfiguracaoSeguranca, type ConfiguracaoSeguranca } from './consultas';
import { DialogoSalvarSeguranca } from './DialogoSalvarSeguranca';
import { IconeInfo, IconeVoltarPadrao } from './icones';
import { erroAoSalvar, mensagemErroConsulta } from './mensagens';
import {
  CAMPOS,
  GRUPOS,
  ajudaParametro,
  camposAlterados,
  corpoDe,
  esquemaDe,
  valoresDe,
  type CampoSeguranca,
  type ValoresFormulario,
} from './parametros';
import './seguranca.css';

/** Por que "Salvar" está desabilitado: nada mudou. */
export const MOTIVO_SEM_ALTERACAO = 'Altere algum parâmetro para salvar';
/** Por que "Voltar ao padrão" está desabilitado num campo. */
export const MOTIVO_JA_NO_PADRAO = 'O valor já é o padrão';
export const MENSAGEM_SALVO = 'Parâmetros de segurança salvos.';
export const NOTA_SISTEMA =
  'O bloqueio de login após tentativas erradas e o limite de tentativas por IP não aparecem aqui: valem para o sistema ' +
  'inteiro, porque o login acontece antes de se saber o tenant. Para mudá-los, fale com quem opera o sistema.';

/**
 * Administração › Segurança: os cinco parâmetros de sessão e senha do tenant, com o padrão e os limites de cada um,
 * "Voltar ao padrão" por campo e salvar com confirmação. Precisa do `ProvedorApi`, do `QueryClientProvider` e da
 * `RaizFluxo` (portal do diálogo).
 */
export function Seguranca() {
  const idTitulo = useId();
  const consulta = useConfiguracaoSeguranca();
  const configuracao = consulta.data;
  const semPermissao = consulta.error instanceof ErroApi && consulta.error.codigo === 'sem_permissao';

  return (
    <section className="fc-seguranca" aria-labelledby={idTitulo}>
      <header className="fc-seguranca-titulo">
        <Texto como="h2" estilo="heading-24" id={idTitulo}>
          Segurança
        </Texto>
        <Texto como="p" estilo="label-14" tom="secundario">
          Sessão, senha e incorporação neste tenant
        </Texto>
      </header>

      {configuracao ? (
        <FormularioSeguranca configuracao={configuracao} />
      ) : consulta.isPending ? (
        <EsqueletoSeguranca />
      ) : (
        <Aviso
          tipo="erro"
          titulo="Não foi possível carregar os parâmetros de segurança"
          acoes={
            semPermissao ? undefined : (
              <Botao tamanho="pequeno" onClick={() => void consulta.refetch()} carregando={consulta.isFetching}>
                Tentar de novo
              </Botao>
            )
          }
        >
          {mensagemErroConsulta(consulta.error)}
        </Aviso>
      )}

      {consulta.isError && configuracao !== undefined ? (
        <Aviso
          tipo="erro"
          titulo="Não foi possível atualizar os parâmetros"
          acoes={
            <Botao tamanho="pequeno" onClick={() => void consulta.refetch()} carregando={consulta.isFetching}>
              Tentar de novo
            </Botao>
          }
        >
          {mensagemErroConsulta(consulta.error)}
        </Aviso>
      ) : null}

      <p className={`fc-seguranca-nota ${classesTexto({ estilo: 'label-13', tom: 'secundario' })}`}>
        <IconeInfo tamanho={14} />
        <span>{NOTA_SISTEMA}</span>
      </p>
    </section>
  );
}

/** Esqueleto com a forma do formulário: três grupos, cinco campos. */
function EsqueletoSeguranca() {
  return (
    <Caixa>
      <Carregando rotulo="Carregando os parâmetros de segurança">
        {GRUPOS.map((grupo) => (
          <div key={grupo.titulo} className="fc-seguranca-esqueleto-grupo">
            <Esqueleto largura={80} />
            {grupo.parametros.map((parametro) => (
              <div key={parametro.campo} className="fc-seguranca-esqueleto-campo">
                <Esqueleto largura={180} />
                <Esqueleto largura={240} />
              </div>
            ))}
          </div>
        ))}
      </Carregando>
    </Caixa>
  );
}

interface Confirmacao {
  novos: Record<CampoSeguranca, number>;
  alterados: CampoSeguranca[];
}

function ehPadrao(texto: string, padrao: number): boolean {
  return /^-?\d+$/.test(texto.trim()) && Number(texto.trim()) === padrao;
}

function FormularioSeguranca({ configuracao }: { configuracao: ConfiguracaoSeguranca }) {
  const botaoSalvar = useRef<HTMLButtonElement>(null);
  const esquema = useMemo(() => esquemaDe(configuracao), [configuracao]);
  const valoresServidor = useMemo(() => valoresDe(configuracao), [configuracao]);
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    reset,
    getValues,
    watch,
    formState: { errors },
  } = useForm<ValoresFormulario>({
    resolver: zodResolver(esquema),
    defaultValues: valoresServidor,
  });

  // Quando os valores em vigor mudam (outra pessoa salvou e a consulta foi refeita), os campos que a pessoa não
  // editou passam a mostrá-los; o que ela digitou fica.
  const servidorAnterior = useRef(valoresServidor);
  useEffect(() => {
    const anterior = servidorAnterior.current;
    servidorAnterior.current = valoresServidor;
    for (const campo of CAMPOS) {
      if (anterior[campo] !== valoresServidor[campo] && getValues(campo) === anterior[campo]) setValue(campo, valoresServidor[campo]);
    }
  }, [valoresServidor, getValues, setValue]);

  const alterar = useAlterarConfiguracaoSeguranca();
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [erroGeral, setErroGeral] = useState<string | undefined>(undefined);

  const valores = watch();
  const alterados = camposAlterados(valores, configuracao);
  const sujo = alterados.length > 0;

  // O diálogo não tem gatilho do Radix (abre pelo envio do formulário): o foco volta à mão, depois que ele fecha.
  function depoisDeFechar(acao: () => void) {
    setTimeout(acao, 0);
  }

  const enviar = handleSubmit((dados) => {
    const mudaram = camposAlterados(dados, configuracao);
    if (mudaram.length === 0) return;
    alterar.reset();
    setSalvo(false);
    setErroGeral(undefined);
    setConfirmacao({ novos: corpoDe(dados), alterados: mudaram });
  });

  function confirmar() {
    if (!confirmacao) return;
    alterar.mutate(confirmacao.novos, {
      onSuccess: (salvos) => {
        // Os campos passam a mostrar o que o servidor gravou (" 1 " vira "1").
        reset(valoresDe(salvos));
        setConfirmacao(null);
        setSalvo(true);
        depoisDeFechar(() => botaoSalvar.current?.focus());
      },
      onError: (erro) => {
        const tela = erroAoSalvar(erro);
        const campos = CAMPOS.filter((campo) => tela.campos[campo] !== undefined);
        // Sem erro de campo (permissão, CSRF, rede…), o diálogo fica aberto, com a nota, para tentar de novo.
        if (campos.length === 0) return;
        setConfirmacao(null);
        setErroGeral(tela.mensagem);
        depoisDeFechar(() => {
          campos.forEach((campo, indice) =>
            setError(campo, { type: 'api', message: tela.campos[campo] }, { shouldFocus: indice === 0 }),
          );
        });
      },
    });
  }

  function fecharConfirmacao() {
    setConfirmacao(null);
    depoisDeFechar(() => botaoSalvar.current?.focus());
  }

  const erroNoDialogo = alterar.isError && confirmacao ? erroAoSalvar(alterar.error).mensagem : undefined;

  return (
    <>
      <form className="fc-seguranca-formulario" onSubmit={enviar} noValidate>
        <Caixa espaco="nenhum" className="fc-seguranca-caixa">
          {GRUPOS.map((grupo) => (
            <fieldset key={grupo.titulo} className="fc-seguranca-grupo">
              <legend className={`fc-seguranca-legenda ${classesTexto({ estilo: 'heading-14' })}`}>{grupo.titulo}</legend>
              {grupo.parametros.map((parametro) => {
                const { campo } = parametro;
                const padrao = configuracao[campo].padrao;
                return (
                  <div key={campo} className="fc-seguranca-parametro">
                    <CampoTexto
                      className="fc-seguranca-campo"
                      rotulo={`${parametro.rotulo} (${parametro.unidade})`}
                      inputMode="numeric"
                      autoComplete="off"
                      dica={ajudaParametro(configuracao[campo])}
                      erro={errors[campo]?.message}
                      {...register(campo)}
                    />
                    <Botao
                      variante="fantasma"
                      tamanho="pequeno"
                      className="fc-seguranca-voltar"
                      icone={<IconeVoltarPadrao tamanho={14} />}
                      aria-label={`Voltar ao padrão: ${parametro.rotulo}`}
                      motivoDesabilitado={ehPadrao(valores[campo], padrao) ? MOTIVO_JA_NO_PADRAO : undefined}
                      onClick={() => setValue(campo, String(padrao), { shouldDirty: true, shouldValidate: true })}
                    >
                      Voltar ao padrão
                    </Botao>
                  </div>
                );
              })}
            </fieldset>
          ))}

          <div className="fc-seguranca-rodape">
            {erroGeral ? <Aviso tipo="erro">{erroGeral}</Aviso> : null}
            {salvo && !sujo ? <Aviso tipo="sucesso">{MENSAGEM_SALVO}</Aviso> : null}
            <div className="fc-seguranca-acoes">
              <Botao
                ref={botaoSalvar}
                type="submit"
                variante="principal"
                motivoDesabilitado={sujo ? undefined : MOTIVO_SEM_ALTERACAO}
                exibirMotivo="ao-lado"
              >
                Salvar
              </Botao>
            </div>
          </div>
        </Caixa>
      </form>

      {/* Fora do <form>: os botões do diálogo não participam do envio. */}
      {confirmacao ? (
        <DialogoSalvarSeguranca
          configuracao={configuracao}
          novos={confirmacao.novos}
          alterados={confirmacao.alterados}
          salvando={alterar.isPending}
          erro={erroNoDialogo}
          aoConfirmar={confirmar}
          aoFechar={fecharConfirmacao}
        />
      ) : null}
    </>
  );
}
