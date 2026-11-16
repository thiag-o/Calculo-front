import { useId, useRef, useState } from 'react';
import { ErroApi } from '../../api';
import { Aviso, Botao, EstadoVazio, Menu, Status, Tabela, Texto, type ColunaTabela } from '../../design-system';
import { useListaChaves, type ChaveApi } from './consultas';
import { dia, diaHora } from './datas';
import { DialogoNovaChave } from './DialogoNovaChave';
import { DialogoRevogarChave } from './DialogoRevogarChave';
import { IconeChave, IconeMaisAcoes } from './icones';
import { mensagemErroConsulta } from './mensagens';
import './integracao.css';

/** Por que "Revogar chave" está desabilitado numa chave já revogada. */
export function motivoChaveRevogada(chave: ChaveApi): string {
  const quando = chave.revogada_em ? dia(chave.revogada_em) : '';
  return quando ? `A chave já foi revogada em ${quando}` : 'A chave já foi revogada';
}

const ATRIBUTO_ACOES = 'data-fc-acoes-chave';

type DialogoAberto = { tipo: 'nova' } | { tipo: 'revogar'; chave: ChaveApi };

function resumo(chaves: readonly ChaveApi[], temMais: boolean): string {
  if (temMais) return `Mais de ${chaves.length.toLocaleString('pt-BR')} chaves`;
  const total = chaves.length === 1 ? '1 chave' : `${chaves.length.toLocaleString('pt-BR')} chaves`;
  const revogadas = chaves.filter((chave) => chave.revogada_em !== null).length;
  if (revogadas === 0) return total;
  return `${total} · ${revogadas === 1 ? '1 revogada' : `${revogadas.toLocaleString('pt-BR')} revogadas`}`;
}

/**
 * Integração › Chaves de API: lista (nome e prefixo, criada, último uso e situação), criar (a chave aparece uma vez,
 * com "Copiar") e revogar com confirmação. Precisa do `ProvedorApi`, do `QueryClientProvider` e da `RaizFluxo`.
 */
export function ChavesApi() {
  const idTitulo = useId();
  const lista = useListaChaves();
  const secao = useRef<HTMLElement>(null);
  const botaoNova = useRef<HTMLButtonElement>(null);
  const [dialogo, setDialogo] = useState<DialogoAberto | null>(null);

  function fechar() {
    setDialogo(null);
  }

  // O diálogo vem do menu da linha, cujo gatilho some ao fechar: o foco volta ao "…" da linha ou, se ela sumiu (ou o
  // diálogo era de criar), ao botão principal. Procurado só dentro da seção (ADR 0002).
  function focoAoFechar() {
    const linha =
      dialogo?.tipo === 'revogar'
        ? secao.current?.querySelector<HTMLElement>(`[${ATRIBUTO_ACOES}="${dialogo.chave.id}"]`)
        : null;
    return linha ?? botaoNova.current;
  }

  const chaves = lista.data;
  const semPermissao = lista.error instanceof ErroApi && lista.error.codigo === 'sem_permissao';
  const novaChave = (tamanho: 'pequeno' | 'padrao', variante: 'principal' | 'secundario', ref?: typeof botaoNova) => (
    <Botao ref={ref} variante={variante} tamanho={tamanho} onClick={() => setDialogo({ tipo: 'nova' })}>
      Nova chave de API
    </Botao>
  );

  const colunas: readonly ColunaTabela<ChaveApi>[] = [
    {
      chave: 'chave',
      titulo: 'Chave',
      larguraEsqueleto: 180,
      celula: (chave) => (
        <div className="fc-integracao-duas-linhas">
          <Texto estilo="label-14" medio className="fc-integracao-quebra">
            {chave.nome}
          </Texto>
          <Texto estilo="mono-13" tom="secundario" className="fc-integracao-quebra">
            {`${chave.prefixo}…`}
          </Texto>
        </div>
      ),
    },
    {
      chave: 'criada',
      titulo: 'Criada',
      largura: '120px',
      larguraEsqueleto: 80,
      celula: (chave) => (
        <Texto estilo="label-14" className="fc-integracao-numero">
          {dia(chave.criada_em)}
        </Texto>
      ),
    },
    {
      chave: 'uso',
      titulo: 'Último uso',
      largura: '180px',
      larguraEsqueleto: 120,
      celula: (chave) =>
        chave.ultimo_uso_em ? (
          <Texto estilo="label-14" className="fc-integracao-numero">
            {diaHora(chave.ultimo_uso_em)}
          </Texto>
        ) : (
          <Texto estilo="label-14" tom="secundario">
            Nunca usada
          </Texto>
        ),
    },
    {
      chave: 'situacao',
      titulo: 'Situação',
      largura: '140px',
      larguraEsqueleto: 60,
      celula: (chave) =>
        chave.revogada_em ? (
          <div className="fc-integracao-duas-linhas">
            <Status cor="cinza">Revogada</Status>
            <Texto estilo="label-13" tom="secundario" className="fc-integracao-numero">
              {`em ${dia(chave.revogada_em)}`}
            </Texto>
          </div>
        ) : (
          <Status cor="verde">Ativa</Status>
        ),
    },
    {
      chave: 'acoes',
      titulo: 'Ações',
      tituloOculto: true,
      alinhamento: 'fim',
      largura: '56px',
      larguraEsqueleto: 20,
      celula: (chave) => (
        <Menu
          gatilho={
            <Botao
              soIcone
              variante="fantasma"
              tamanho="pequeno"
              rotulo={`Mais ações para a chave ${chave.nome}`}
              icone={<IconeMaisAcoes />}
              data-fc-acoes-chave={chave.id}
            />
          }
          itens={[
            {
              rotulo: 'Revogar chave',
              perigo: true,
              aoSelecionar: () => setDialogo({ tipo: 'revogar', chave }),
              motivoDesabilitado: chave.revogada_em ? motivoChaveRevogada(chave) : undefined,
            },
          ]}
        />
      ),
    },
  ];

  return (
    <section ref={secao} className="fc-integracao-secao" aria-labelledby={idTitulo}>
      <header className="fc-integracao-topo">
        <div className="fc-integracao-titulo">
          <Texto como="h2" estilo="heading-24" id={idTitulo}>
            Chaves de API
          </Texto>
          <Texto como="p" estilo="label-14" tom="secundario">
            {chaves ? resumo(chaves, lista.hasNextPage) : 'Para o backend do sistema hospedeiro pedir tokens de incorporação'}
          </Texto>
        </div>
        {novaChave('padrao', 'principal', botaoNova)}
      </header>

      <Tabela
        legenda="Chaves de API do tenant"
        colunas={colunas}
        linhas={chaves}
        chaveLinha={(chave) => chave.id}
        carregando={lista.isPending}
        erro={
          lista.isError && chaves === undefined ? (
            <Aviso
              tipo="erro"
              titulo="Não foi possível carregar as chaves de API"
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
            icone={<IconeChave />}
            titulo="Nenhuma chave de API ainda"
            descricao="Crie uma chave para o sistema hospedeiro incorporar o módulo."
            acao={novaChave('pequeno', 'secundario')}
          />
        }
      />

      {lista.isError && chaves !== undefined ? (
        <Aviso
          tipo="erro"
          titulo={lista.isFetchNextPageError ? 'Não foi possível carregar mais chaves' : 'Não foi possível atualizar a lista'}
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
          {mensagemErroConsulta(lista.error)}
        </Aviso>
      ) : lista.hasNextPage ? (
        <div className="fc-integracao-mais">
          <Botao carregando={lista.isFetchingNextPage} onClick={() => void lista.fetchNextPage()}>
            Carregar mais chaves
          </Botao>
        </div>
      ) : null}

      {dialogo?.tipo === 'nova' ? <DialogoNovaChave aoFechar={fechar} focoAoFechar={focoAoFechar} /> : null}
      {dialogo?.tipo === 'revogar' ? (
        <DialogoRevogarChave key={dialogo.chave.id} chave={dialogo.chave} aoFechar={fechar} focoAoFechar={focoAoFechar} />
      ) : null}
    </section>
  );
}
