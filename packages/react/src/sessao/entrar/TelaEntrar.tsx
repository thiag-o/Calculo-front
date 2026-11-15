import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Aviso, Botao, Caixa, CampoSenha, CampoTexto, Texto } from '../../design-system';
import { useEntrar } from '../mutacoes';
import type { Sessao } from '../useSessao';
import { erroDoLogin } from './mensagemErroLogin';
import './entrar.css';

const esquema = z.object({
  email: z.string().trim().min(1, 'Informe o e-mail'),
  senha: z.string().min(1, 'Informe a senha'),
});

type DadosLogin = z.infer<typeof esquema>;

export interface TelaEntrarProps {
  /** Chamado com a sessão criada, depois do login. O casca leva o usuário ao módulo. */
  onEntrar?: (sessao: Sessao) => void;
}

/**
 * Tela de login (e-mail e senha). Precisa do `ProvedorApi` (modo cookie) e do `QueryClientProvider`;
 * o `<Entrar>` público monta os dois.
 */
export function TelaEntrar({ onEntrar }: TelaEntrarProps) {
  const idTitulo = useId();
  const entrar = useEntrar();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DadosLogin>({ resolver: zodResolver(esquema), defaultValues: { email: '', senha: '' } });

  const erroApi = entrar.error ? erroDoLogin(entrar.error) : undefined;

  const enviar = handleSubmit((dados) => {
    entrar.mutate(dados, { onSuccess: (sessao) => onEntrar?.(sessao) });
  });

  return (
    <div className="fc-entrar">
      <Caixa como="section" className="fc-entrar-caixa" aria-labelledby={idTitulo}>
        <header className="fc-entrar-cabecalho">
          <Texto como="h1" estilo="heading-24" id={idTitulo} className="fc-entrar-titulo">
            Fluxo de Cálculo
          </Texto>
          <Texto como="p" estilo="copy-14" tom="secundario" className="fc-entrar-subtitulo">
            Entre com o seu e-mail e a sua senha.
          </Texto>
        </header>
        <form className="fc-entrar-formulario" onSubmit={enviar} noValidate>
          <CampoTexto
            rotulo="E-mail"
            type="email"
            autoComplete="username"
            autoCapitalize="off"
            spellCheck={false}
            // A tela existe só para isto; o foco começa no primeiro campo.
            autoFocus
            erro={errors.email?.message ?? erroApi?.campos.email}
            {...register('email')}
          />
          <CampoSenha rotulo="Senha" erro={errors.senha?.message ?? erroApi?.campos.senha} {...register('senha')} />
          {erroApi ? <Aviso tipo="erro">{erroApi.mensagem}</Aviso> : null}
          <Botao type="submit" variante="principal" tamanho="grande" className="fc-entrar-enviar" carregando={entrar.isPending}>
            Entrar
          </Botao>
        </form>
        <Texto como="p" estilo="label-12" tom="terciario" className="fc-entrar-ajuda">
          Esqueceu a senha? Peça ao administrador um link para criar uma nova.
        </Texto>
      </Caixa>
    </div>
  );
}
