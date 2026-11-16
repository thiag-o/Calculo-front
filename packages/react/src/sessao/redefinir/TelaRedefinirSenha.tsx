import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useId, useMemo, useRef, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Aviso, Botao, Caixa, CampoSenha, Carregando, Esqueleto, Texto } from '../../design-system';
import {
  ehLinkInvalido,
  erroDoEnvio,
  MENSAGEM_LINK_INVALIDO,
  MENSAGEM_SENHA_SALVA,
  mensagemErroVerificacao,
  mensagemPrazo,
  regrasSenha,
  tamanhoSenha,
} from './mensagensRedefinicao';
import { useRedefinirSenha, useVerificarLink, type LinkVerificado } from './redefinicao';
import './redefinir.css';

export interface TelaRedefinirSenhaProps {
  /** O token do link (`/redefinir?token=...`). Sem token, ou vazio, a tela diz que o link não vale. */
  token?: string | null;
  /** Chamado depois que a senha foi salva. O casca decide se leva a pessoa ao login. */
  onSalvar?: () => void;
}

/**
 * Tela pública de nova senha pelo link de redefinição (o mesmo link cria a primeira senha do Admin). Ao abrir,
 * consulta o link para mostrar a senha mínima e o prazo; link inválido não mostra o formulário. Precisa do
 * `ProvedorApi` e do `QueryClientProvider`; o `<RedefinirSenha>` público monta os dois.
 */
export function TelaRedefinirSenha({ token, onSalvar }: TelaRedefinirSenhaProps) {
  const idTitulo = useId();
  const tokenLimpo = token ?? '';
  const verificacao = useVerificarLink(tokenLimpo);

  let conteudo: ReactNode;
  if (tokenLimpo === '' || ehLinkInvalido(verificacao.error)) {
    conteudo = <Aviso tipo="erro">{MENSAGEM_LINK_INVALIDO}</Aviso>;
  } else if (verificacao.data) {
    // Outro token, outro formulário: nada do link anterior fica nos campos.
    conteudo = <FormularioSenha key={tokenLimpo} token={tokenLimpo} link={verificacao.data} onSalvar={onSalvar} />;
  } else if (verificacao.isError) {
    conteudo = (
      <Aviso
        tipo="erro"
        titulo="Não foi possível verificar o link"
        acoes={
          <Botao tamanho="pequeno" carregando={verificacao.isFetching} onClick={() => void verificacao.refetch()}>
            Tentar de novo
          </Botao>
        }
      >
        {mensagemErroVerificacao(verificacao.error)}
      </Aviso>
    );
  } else {
    conteudo = <CarregandoFormulario />;
  }

  return (
    <div className="fc-redefinir">
      <Caixa como="section" className="fc-redefinir-caixa" aria-labelledby={idTitulo}>
        <Texto como="h1" estilo="heading-24" id={idTitulo} className="fc-redefinir-titulo">
          Nova senha
        </Texto>
        {conteudo}
      </Caixa>
    </div>
  );
}

/** Esqueleto com a forma do formulário: a frase do prazo, os dois campos e o botão. */
function CarregandoFormulario() {
  return (
    <Carregando rotulo="Verificando o link">
      <Esqueleto largura="80%" />
      {[0, 1].map((campo) => (
        <div key={campo} className="fc-redefinir-esqueleto-campo">
          <Esqueleto largura={96} />
          <Esqueleto largura="100%" className="fc-redefinir-esqueleto-entrada" />
        </div>
      ))}
      <Esqueleto largura="100%" className="fc-redefinir-esqueleto-botao" />
    </Carregando>
  );
}

interface DadosSenha {
  nova_senha: string;
  confirmacao: string;
}

/** Regras do cliente: as mesmas do servidor que a tela conhece (o e-mail, só o servidor confere). */
function esquemaSenha(senhaMinima: number) {
  return z.object({ nova_senha: z.string(), confirmacao: z.string() }).superRefine((dados, contexto) => {
    if (dados.nova_senha === '') {
      contexto.addIssue({ code: 'custom', path: ['nova_senha'], message: 'Informe a nova senha' });
    } else if (tamanhoSenha(dados.nova_senha) < senhaMinima) {
      contexto.addIssue({ code: 'custom', path: ['nova_senha'], message: `Use pelo menos ${senhaMinima} caracteres` });
    }
    if (dados.confirmacao === '') {
      contexto.addIssue({ code: 'custom', path: ['confirmacao'], message: 'Repita a nova senha' });
    } else if (dados.confirmacao !== dados.nova_senha) {
      contexto.addIssue({
        code: 'custom',
        path: ['confirmacao'],
        message: 'As senhas estão diferentes. Digite a mesma senha nos dois campos',
      });
    }
  });
}

interface FormularioSenhaProps {
  token: string;
  link: LinkVerificado;
  onSalvar?: () => void;
}

function FormularioSenha({ token, link, onSalvar }: FormularioSenhaProps) {
  const salvar = useRedefinirSenha();
  const esquema = useMemo(() => esquemaSenha(link.senha_minima), [link.senha_minima]);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DadosSenha>({ resolver: zodResolver(esquema), defaultValues: { nova_senha: '', confirmacao: '' } });

  if (salvar.isSuccess) {
    return (
      <Resultado>
        <Aviso tipo="sucesso">{MENSAGEM_SENHA_SALVA}</Aviso>
      </Resultado>
    );
  }
  if (ehLinkInvalido(salvar.error)) {
    // O link venceu ou foi usado enquanto a pessoa digitava.
    return (
      <Resultado>
        <Aviso tipo="erro">{MENSAGEM_LINK_INVALIDO}</Aviso>
      </Resultado>
    );
  }

  const erroApi = salvar.error ? erroDoEnvio(salvar.error) : undefined;
  const prazo = mensagemPrazo(link.expira_em);

  const enviar = handleSubmit((dados) => {
    salvar.mutate({ token, nova_senha: dados.nova_senha }, { onSuccess: () => onSalvar?.() });
  });

  return (
    <>
      <Texto como="p" estilo="copy-14" tom="secundario" className="fc-redefinir-subtitulo">
        Crie a senha que você vai usar para entrar.{prazo ? ` ${prazo}` : null}
      </Texto>
      <form className="fc-redefinir-formulario" onSubmit={enviar} noValidate>
        <CampoSenha
          rotulo="Nova senha"
          autoComplete="new-password"
          // A tela existe só para isto; o foco começa no primeiro campo.
          autoFocus
          dica={regrasSenha(link.senha_minima)}
          erro={errors.nova_senha?.message ?? erroApi?.novaSenha}
          {...register('nova_senha')}
        />
        <CampoSenha
          rotulo="Repita a nova senha"
          autoComplete="new-password"
          erro={errors.confirmacao?.message}
          {...register('confirmacao')}
        />
        {erroApi?.mensagem ? <Aviso tipo="erro">{erroApi.mensagem}</Aviso> : null}
        <Botao type="submit" variante="principal" tamanho="grande" className="fc-redefinir-enviar" carregando={salvar.isPending}>
          Salvar
        </Botao>
      </form>
    </>
  );
}

/**
 * O fim do formulário (senha salva ou link vencido no envio). O botão que tinha o foco sumiu: o foco vai para a
 * mensagem, que o leitor de tela lê.
 */
function Resultado({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div ref={ref} tabIndex={-1} className="fc-redefinir-resultado">
      {children}
    </div>
  );
}
