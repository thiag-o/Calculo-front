import { useId, useRef, useState } from 'react';
import { ErroApi } from '../../api';
import { Aviso, Botao, EstadoVazio, Menu, Selo, Status, Tabela, Texto, type ColunaTabela } from '../../design-system';
import { useListaUsuarios, type Usuario } from './consultas';
import { DialogoLinkRedefinicao } from './DialogoLinkRedefinicao';
import { DialogoUsuario } from './DialogoUsuario';
import { IconeMaisAcoes, IconeUsuarios } from './icones';
import { mensagemErroLista } from './mensagens';
import './usuarios.css';

export const MOTIVO_LINK_EXTERNO = 'Usuário da incorporação: entra pelo sistema hospedeiro, sem senha';
export const MOTIVO_LINK_INATIVO = 'Ative o usuário para gerar o link';

type DialogoAberto = { tipo: 'novo' } | { tipo: 'editar'; usuario: Usuario } | { tipo: 'link'; usuario: Usuario };

function resumo(total: number, temMais: boolean): string {
  if (temMais) return `Mais de ${total} usuários`;
  return total === 1 ? '1 usuário' : `${total} usuários`;
}

/**
 * Administração › Usuários: lista do tenant (nome, e-mail, papéis e situação), criar, editar e gerar o link de
 * redefinição de senha. Precisa do `ProvedorApi`, do `QueryClientProvider` e da `RaizFluxo` (portais dos diálogos).
 */
export function Usuarios() {
  const idTitulo = useId();
  const lista = useListaUsuarios();
  const secao = useRef<HTMLElement>(null);
  const botaoNovo = useRef<HTMLButtonElement>(null);
  const [dialogo, setDialogo] = useState<DialogoAberto | null>(null);

  // O diálogo vem do menu da linha, cujo gatilho some ao fechar: o foco volta ao "…" da linha ou, se ela sumiu (ou o
  // diálogo era de criar), ao "Novo usuário". Procurado só dentro da tela (ADR 0002).
  function focoAoFechar() {
    const linha =
      dialogo && dialogo.tipo !== 'novo'
        ? secao.current?.querySelector<HTMLElement>(`[data-fc-acoes-usuario="${dialogo.usuario.id}"]`)
        : null;
    return linha ?? botaoNovo.current;
  }

  function fechar() {
    setDialogo(null);
  }

  const usuarios = lista.data;
  const semPermissao = lista.error instanceof ErroApi && lista.error.codigo === 'sem_permissao';
  const novoUsuario = (tamanho: 'pequeno' | 'padrao', variante: 'principal' | 'secundario', ref?: typeof botaoNovo) => (
    <Botao ref={ref} variante={variante} tamanho={tamanho} onClick={() => setDialogo({ tipo: 'novo' })}>
      Novo usuário
    </Botao>
  );

  const colunas: readonly ColunaTabela<Usuario>[] = [
    {
      chave: 'nome',
      titulo: 'Nome',
      larguraEsqueleto: 180,
      celula: (usuario) => (
        <div className="fc-usuarios-pessoa">
          <span className="fc-usuarios-nome">
            <Texto estilo="label-14" medio>
              {usuario.nome}
            </Texto>
            {usuario.externo ? <Selo>Incorporação</Selo> : null}
          </span>
          <Texto estilo="label-13" tom="secundario" className="fc-usuarios-email">
            {usuario.email}
          </Texto>
        </div>
      ),
    },
    {
      chave: 'papeis',
      titulo: 'Papéis',
      larguraEsqueleto: 120,
      celula: (usuario) =>
        usuario.papeis.length === 0 ? null : (
          <ul className="fc-usuarios-lista-papeis" aria-label={`Papéis de ${usuario.nome}`}>
            {usuario.papeis.map((papel) => (
              <li key={papel.id}>
                <Selo>{papel.nome}</Selo>
              </li>
            ))}
          </ul>
        ),
    },
    {
      chave: 'situacao',
      titulo: 'Situação',
      largura: '120px',
      larguraEsqueleto: 60,
      celula: (usuario) => (usuario.ativo ? <Status cor="verde">Ativo</Status> : <Status cor="cinza">Inativo</Status>),
    },
    {
      chave: 'acoes',
      titulo: 'Ações',
      tituloOculto: true,
      alinhamento: 'fim',
      largura: '56px',
      larguraEsqueleto: 20,
      celula: (usuario) => (
        <Menu
          gatilho={
            <Botao
              soIcone
              variante="fantasma"
              tamanho="pequeno"
              rotulo={`Mais ações para ${usuario.nome}`}
              icone={<IconeMaisAcoes />}
              data-fc-acoes-usuario={usuario.id}
            />
          }
          itens={[
            { rotulo: 'Editar usuário', aoSelecionar: () => setDialogo({ tipo: 'editar', usuario }) },
            {
              rotulo: 'Gerar link de redefinição',
              aoSelecionar: () => setDialogo({ tipo: 'link', usuario }),
              motivoDesabilitado: usuario.externo ? MOTIVO_LINK_EXTERNO : usuario.ativo ? undefined : MOTIVO_LINK_INATIVO,
            },
          ]}
        />
      ),
    },
  ];

  return (
    <section ref={secao} className="fc-usuarios" aria-labelledby={idTitulo}>
      <header className="fc-usuarios-topo">
        <div className="fc-usuarios-titulo">
          <Texto como="h2" estilo="heading-24" id={idTitulo}>
            Usuários
          </Texto>
          <Texto como="p" estilo="label-14" tom="secundario">
            {usuarios ? resumo(usuarios.length, lista.hasNextPage) : 'Quem acessa este tenant e com quais papéis'}
          </Texto>
        </div>
        {novoUsuario('padrao', 'principal', botaoNovo)}
      </header>

      <Tabela
        legenda="Usuários do tenant"
        colunas={colunas}
        linhas={usuarios}
        chaveLinha={(usuario) => usuario.id}
        carregando={lista.isPending}
        erro={
          lista.isError && usuarios === undefined ? (
            <Aviso
              tipo="erro"
              titulo="Não foi possível carregar os usuários"
              acoes={
                semPermissao ? undefined : (
                  <Botao tamanho="pequeno" onClick={() => void lista.refetch()} carregando={lista.isFetching}>
                    Tentar de novo
                  </Botao>
                )
              }
            >
              {mensagemErroLista(lista.error)}
            </Aviso>
          ) : undefined
        }
        vazio={
          <EstadoVazio
            icone={<IconeUsuarios />}
            titulo="Nenhum usuário ainda"
            descricao="Crie o primeiro usuário e gere o link para a pessoa definir a senha."
            acao={novoUsuario('pequeno', 'secundario')}
          />
        }
      />

      {lista.isError && usuarios !== undefined ? (
        <Aviso
          tipo="erro"
          titulo={lista.isFetchNextPageError ? 'Não foi possível carregar mais usuários' : 'Não foi possível atualizar a lista'}
          acoes={
            <Botao
              tamanho="pequeno"
              carregando={lista.isFetching}
              onClick={() => void (lista.isFetchNextPageError ? lista.fetchNextPage() : lista.refetch())}
            >
              Tentar de novo
            </Botao>
          }
        >
          {mensagemErroLista(lista.error)}
        </Aviso>
      ) : lista.hasNextPage ? (
        <div className="fc-usuarios-mais">
          <Botao carregando={lista.isFetchingNextPage} onClick={() => void lista.fetchNextPage()}>
            Carregar mais usuários
          </Botao>
        </div>
      ) : null}

      {dialogo?.tipo === 'novo' ? <DialogoUsuario aoFechar={fechar} focoAoFechar={focoAoFechar} /> : null}
      {dialogo?.tipo === 'editar' ? <DialogoUsuario key={dialogo.usuario.id} usuario={dialogo.usuario} aoFechar={fechar} focoAoFechar={focoAoFechar} /> : null}
      {dialogo?.tipo === 'link' ? <DialogoLinkRedefinicao key={dialogo.usuario.id} usuario={dialogo.usuario} aoFechar={fechar} focoAoFechar={focoAoFechar} /> : null}
    </section>
  );
}
