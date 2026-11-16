import { useId, useState } from 'react';
import { ErroApi } from '../../api';
import { Aviso, Botao, EstadoVazio, Menu, Selo, Tabela, Texto, type ColunaTabela } from '../../design-system';
import { useListaPapeis, type Papel } from './consultas';
import { DialogoPapel } from './DialogoPapel';
import { DialogoRemoverPapel } from './DialogoRemoverPapel';
import { IconeCadeado, IconeEscudo, IconeMaisAcoes } from './icones';
import { mensagemErroConsulta } from './mensagens';
import './papeis.css';

/** Por que o Admin não tem ações: mostrado na linha dele. */
export const MOTIVO_PAPEL_FIXO = 'Tem todas as permissões e não pode ser editado nem removido';

/** Por que "Remover papel" está desabilitado num papel que alguém usa. */
export function motivoPapelEmUso(totalUsuarios: number): string {
  return `Em uso por ${contagem(totalUsuarios, 'usuário', 'usuários')}: tire o papel deles em Usuários antes de remover`;
}

type DialogoAberto = { tipo: 'novo' } | { tipo: 'editar'; papel: Papel } | { tipo: 'remover'; papel: Papel };

function contagem(total: number, singular: string, plural: string): string {
  return `${total.toLocaleString('pt-BR')} ${total === 1 ? singular : plural}`;
}

function resumoPermissoes(papel: Papel): string {
  if (papel.permissoes.length === 0) return 'Nenhuma permissão';
  return contagem(papel.permissoes.length, 'permissão', 'permissões');
}

/**
 * Administração › Papéis: lista dos papéis do tenant, criar e editar com o catálogo de permissões e remover com
 * confirmação. O Admin (`fixo`) aparece travado, com o motivo, e não oferece editar nem remover.
 * Precisa do `ProvedorApi`, do `QueryClientProvider` e da `RaizFluxo` (portais dos diálogos e menus).
 */
export function Papeis() {
  const idTitulo = useId();
  const lista = useListaPapeis();
  const [dialogo, setDialogo] = useState<DialogoAberto | null>(null);
  const fechar = () => setDialogo(null);

  const papeis = lista.data;
  const semPermissao = lista.error instanceof ErroApi && lista.error.codigo === 'sem_permissao';
  const novoPapel = (tamanho: 'pequeno' | 'padrao', variante: 'principal' | 'secundario') => (
    <Botao variante={variante} tamanho={tamanho} onClick={() => setDialogo({ tipo: 'novo' })}>
      Novo papel
    </Botao>
  );

  const colunas: readonly ColunaTabela<Papel>[] = [
    {
      chave: 'papel',
      titulo: 'Papel',
      larguraEsqueleto: 180,
      celula: (papel) => (
        <div className="fc-papeis-papel">
          <span className="fc-papeis-nome">
            <Texto estilo="label-14" medio>
              {papel.nome}
            </Texto>
            {papel.fixo ? <Selo>Fixo</Selo> : null}
          </span>
          {papel.fixo ? (
            <Texto estilo="label-13" tom="secundario" className="fc-papeis-motivo">
              <IconeCadeado tamanho={14} />
              {MOTIVO_PAPEL_FIXO}
            </Texto>
          ) : (
            <Texto estilo="label-13" tom="secundario">
              {resumoPermissoes(papel)}
            </Texto>
          )}
        </div>
      ),
    },
    {
      chave: 'usuarios',
      titulo: 'Usuários',
      alinhamento: 'fim',
      largura: '120px',
      larguraEsqueleto: 40,
      celula: (papel) => (
        <Texto estilo="label-14" className="fc-papeis-numero">
          {papel.total_usuarios.toLocaleString('pt-BR')}
        </Texto>
      ),
    },
    {
      chave: 'acoes',
      titulo: 'Ações',
      tituloOculto: true,
      alinhamento: 'fim',
      largura: '56px',
      larguraEsqueleto: 20,
      celula: (papel) =>
        papel.fixo ? (
          // Sem menu: o Admin não oferece editar nem remover. O cadeado ocupa o lugar do "…".
          <span className="fc-papeis-travado" role="img" aria-label={`${papel.nome} travado`}>
            <IconeCadeado />
          </span>
        ) : (
          <Menu
            gatilho={
              <Botao soIcone variante="fantasma" tamanho="pequeno" rotulo={`Mais ações para ${papel.nome}`} icone={<IconeMaisAcoes />} />
            }
            itens={[
              { rotulo: 'Editar papel', aoSelecionar: () => setDialogo({ tipo: 'editar', papel }) },
              {
                rotulo: 'Remover papel',
                perigo: true,
                aoSelecionar: () => setDialogo({ tipo: 'remover', papel }),
                motivoDesabilitado: papel.total_usuarios > 0 ? motivoPapelEmUso(papel.total_usuarios) : undefined,
              },
            ]}
          />
        ),
    },
  ];

  return (
    <section className="fc-papeis" aria-labelledby={idTitulo}>
      <header className="fc-papeis-topo">
        <div className="fc-papeis-titulo">
          <Texto como="h2" estilo="heading-24" id={idTitulo}>
            Papéis
          </Texto>
          <Texto como="p" estilo="label-14" tom="secundario">
            {papeis ? contagem(papeis.length, 'papel', 'papéis') : 'Conjuntos de permissões dados aos usuários do tenant'}
          </Texto>
        </div>
        {novoPapel('padrao', 'principal')}
      </header>

      <Tabela
        legenda="Papéis do tenant"
        colunas={colunas}
        linhas={papeis}
        chaveLinha={(papel) => papel.id}
        carregando={lista.isPending}
        erro={
          lista.isError && papeis === undefined ? (
            <Aviso
              tipo="erro"
              titulo="Não foi possível carregar os papéis"
              acoes={
                semPermissao ? undefined : (
                  <Botao tamanho="pequeno" onClick={() => void lista.refetch()} carregando={lista.isFetching}>
                    Tentar de novo
                  </Botao>
                )
              }
            >
              {mensagemErroConsulta(lista.error)}
            </Aviso>
          ) : undefined
        }
        vazio={
          <EstadoVazio
            icone={<IconeEscudo />}
            titulo="Nenhum papel ainda"
            descricao="Crie um papel com as permissões que um grupo de usuários precisa."
            acao={novoPapel('pequeno', 'secundario')}
          />
        }
      />

      {lista.isError && papeis !== undefined ? (
        <Aviso
          tipo="erro"
          titulo="Não foi possível atualizar a lista"
          acoes={
            <Botao tamanho="pequeno" carregando={lista.isFetching} onClick={() => void lista.refetch()}>
              Tentar de novo
            </Botao>
          }
        >
          {mensagemErroConsulta(lista.error)}
        </Aviso>
      ) : null}

      {dialogo?.tipo === 'novo' ? <DialogoPapel aoFechar={fechar} /> : null}
      {dialogo?.tipo === 'editar' ? <DialogoPapel key={dialogo.papel.id} papel={dialogo.papel} aoFechar={fechar} /> : null}
      {dialogo?.tipo === 'remover' ? <DialogoRemoverPapel key={dialogo.papel.id} papel={dialogo.papel} aoFechar={fechar} /> : null}
    </section>
  );
}
