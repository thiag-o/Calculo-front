import { useQueryClient } from '@tanstack/react-query';
import { useId, useRef, useState } from 'react';
import { ErroApi } from '../../api';
import {
  Aviso,
  Botao,
  CampoTexto,
  EstadoVazio,
  Selecao,
  Status,
  Tabela,
  Texto,
  type ColunaTabela,
  type OpcaoSelecao,
} from '../../design-system';
import { chaveListaAcessos, SEM_FILTROS, useListaAcessos, type EventoAcesso, type FiltrosAcessos } from './consultas';
import { diaHora } from './datas';
import { IconeFiltroVazio, IconeHistorico } from './icones';
import { erroDeFiltro, erroDoCampo, MENSAGEM_PERIODO_INVERTIDO, mensagemErroLista } from './mensagens';
import { diaValido, periodoInvertido } from './periodo';
import { apresentacaoDoTipo, TIPOS_EVENTO } from './tiposEvento';
import './acessos.css';

/** Valor de "Todos os tipos" no filtro (o Radix Select não aceita valor vazio). */
const TODOS_OS_TIPOS = 'todos';

const OPCOES_TIPO: readonly OpcaoSelecao[] = [
  { valor: TODOS_OS_TIPOS, rotulo: 'Todos os tipos' },
  ...TIPOS_EVENTO.map((tipo) => ({ valor: tipo.tipo, rotulo: tipo.rotulo })),
];

const SUBTITULO = 'Logins, falhas, bloqueios e mudanças de acesso neste tenant';

function temFiltro(filtros: FiltrosAcessos): boolean {
  return filtros.tipo !== null || filtros.de !== '' || filtros.ate !== '';
}

function resumo(total: number, temMais: boolean, filtrado: boolean): string {
  const quantos = total.toLocaleString('pt-BR');
  const contagem = total === 1 ? '1 evento' : `${quantos} eventos`;
  const base = temMais ? `Mais de ${contagem}` : contagem;
  return filtrado ? `${base} com esses filtros` : base;
}

const colunas: readonly ColunaTabela<EventoAcesso>[] = [
  {
    chave: 'quando',
    titulo: 'Quando',
    largura: '176px',
    larguraEsqueleto: 128,
    celula: (evento) => (
      <Texto estilo="label-14" className="fc-acessos-numero">
        {diaHora(evento.ocorrido_em)}
      </Texto>
    ),
  },
  {
    chave: 'evento',
    titulo: 'Evento',
    larguraEsqueleto: 140,
    celula: (evento) => {
      const tipo = apresentacaoDoTipo(evento.tipo);
      return <Status cor={tipo.cor}>{tipo.rotulo}</Status>;
    },
  },
  {
    chave: 'quem',
    titulo: 'Quem',
    larguraEsqueleto: 180,
    celula: (evento) => (
      <Texto estilo="label-14" className="fc-acessos-quebra">
        {evento.email_informado}
      </Texto>
    ),
  },
  {
    chave: 'ip',
    titulo: 'IP',
    larguraEsqueleto: 96,
    celula: (evento) =>
      evento.ip ? (
        <Texto estilo="mono-13" className="fc-acessos-quebra">
          {evento.ip}
        </Texto>
      ) : null,
  },
  {
    chave: 'detalhe',
    titulo: 'Detalhe',
    larguraEsqueleto: 160,
    celula: (evento) =>
      evento.detalhe ? (
        <Texto estilo="label-14" tom="secundario" className="fc-acessos-quebra">
          {evento.detalhe}
        </Texto>
      ) : null,
  },
];

/**
 * Auditoria › Acessos: os eventos de acesso do tenant (logins, falhas, bloqueios, saídas e mudanças de acesso), do mais
 * recente ao mais antigo, com filtro por tipo e por período e "Carregar mais eventos" pelo cursor. Os filtros valem ao
 * mudar o valor e levam a lista de volta à primeira página. Precisa do `ProvedorApi`, do `QueryClientProvider` e da
 * `RaizFluxo` (portal da lista do filtro por tipo).
 */
export function Acessos() {
  const idTitulo = useId();
  const queryClient = useQueryClient();
  const filtroTipo = useRef<HTMLButtonElement>(null);
  // O que está nos campos e o que vale na lista: um período invertido fica só nos campos, com o erro, e a lista
  // continua com o último período válido.
  const [campos, setCampos] = useState<FiltrosAcessos>(SEM_FILTROS);
  const [filtros, setFiltros] = useState<FiltrosAcessos>(SEM_FILTROS);
  const lista = useListaAcessos(filtros);

  function mudar(novos: FiltrosAcessos) {
    setCampos(novos);
    const de = diaValido(novos.de) ? novos.de : '';
    const ate = diaValido(novos.ate) ? novos.ate : '';
    // Com o período invertido, o tipo ainda vale; o período fica no último válido até ser corrigido.
    setFiltros((atuais) => (periodoInvertido(de, ate) ? { ...atuais, tipo: novos.tipo } : { tipo: novos.tipo, de, ate }));
  }

  function limparFiltros() {
    setCampos(SEM_FILTROS);
    setFiltros(SEM_FILTROS);
    // A ação some com a lista nova: o foco vai para o primeiro filtro.
    filtroTipo.current?.focus();
  }

  const eventos = lista.data;
  const filtrado = temFiltro(filtros);
  const erroSemDados = lista.isError && eventos === undefined ? lista.error : null;
  const semPermissao = erroSemDados instanceof ErroApi && erroSemDados.codigo === 'sem_permissao';
  const invertido = periodoInvertido(campos.de, campos.ate);
  const erroDe = erroDoCampo(erroSemDados, 'desde');
  const erroAte = invertido ? MENSAGEM_PERIODO_INVERTIDO : erroDoCampo(erroSemDados, 'ate');
  const cursorInvalido = lista.error instanceof ErroApi && lista.error.codigo === 'cursor_invalido';

  const botaoLimpar = (
    <Botao tamanho="pequeno" variante="secundario" onClick={limparFiltros}>
      Limpar filtros
    </Botao>
  );

  return (
    <section className="fc-acessos" aria-labelledby={idTitulo}>
      <header className="fc-acessos-titulo">
        <Texto como="h2" estilo="heading-24" id={idTitulo}>
          Acessos
        </Texto>
        <Texto como="p" estilo="label-14" tom="secundario">
          {eventos && eventos.length > 0 ? resumo(eventos.length, lista.hasNextPage, filtrado) : SUBTITULO}
        </Texto>
      </header>

      <div className="fc-acessos-filtros" role="group" aria-label="Filtros dos eventos">
        <Selecao
          ref={filtroTipo}
          className="fc-acessos-filtro-tipo"
          rotulo="Tipo de evento"
          opcoes={OPCOES_TIPO}
          value={campos.tipo ?? TODOS_OS_TIPOS}
          onValueChange={(valor) => mudar({ ...campos, tipo: valor === TODOS_OS_TIPOS ? null : valor })}
        />
        <CampoTexto
          className="fc-acessos-filtro-dia"
          rotulo="De"
          type="date"
          value={campos.de}
          max={diaValido(campos.ate) ? campos.ate : undefined}
          erro={erroDe}
          onChange={(evento) => mudar({ ...campos, de: evento.target.value })}
        />
        <CampoTexto
          className="fc-acessos-filtro-dia"
          rotulo="Até"
          type="date"
          value={campos.ate}
          min={diaValido(campos.de) ? campos.de : undefined}
          erro={erroAte}
          onChange={(evento) => mudar({ ...campos, ate: evento.target.value })}
        />
      </div>

      <Tabela
        legenda="Eventos de acesso do tenant"
        colunas={colunas}
        linhas={eventos}
        chaveLinha={(evento) => evento.id}
        carregando={lista.isPending}
        linhasCarregando={5}
        erro={
          erroSemDados ? (
            <Aviso
              tipo="erro"
              titulo="Não foi possível carregar os eventos de acesso"
              acoes={
                semPermissao ? undefined : erroDeFiltro(erroSemDados) ? (
                  botaoLimpar
                ) : (
                  <Botao tamanho="pequeno" onClick={() => void lista.refetch()} carregando={lista.isFetching}>
                    Tentar de novo
                  </Botao>
                )
              }
            >
              {mensagemErroLista(erroSemDados)}
            </Aviso>
          ) : undefined
        }
        vazio={
          filtrado ? (
            <EstadoVazio
              icone={<IconeFiltroVazio />}
              titulo="Nenhum evento com esses filtros"
              descricao="Mude o tipo ou o período, ou limpe os filtros para ver todos os eventos."
              acao={botaoLimpar}
            />
          ) : (
            <EstadoVazio
              icone={<IconeHistorico />}
              titulo="Nenhum evento de acesso ainda"
              descricao="Os logins e as mudanças de acesso deste tenant aparecem aqui."
            />
          )
        }
      />

      {lista.isError && eventos !== undefined ? (
        <Aviso
          tipo="erro"
          titulo={lista.isFetchNextPageError ? 'Não foi possível carregar mais eventos' : 'Não foi possível atualizar a lista'}
          acoes={
            cursorInvalido ? (
              <Botao
                tamanho="pequeno"
                carregando={lista.isFetching}
                onClick={() => void queryClient.resetQueries({ queryKey: chaveListaAcessos(filtros), exact: true })}
              >
                Recarregar lista
              </Botao>
            ) : (
              <Botao
                tamanho="pequeno"
                carregando={lista.isFetching}
                onClick={() => void (lista.isFetchNextPageError ? lista.fetchNextPage() : lista.refetch())}
              >
                Tentar de novo
              </Botao>
            )
          }
        >
          {mensagemErroLista(lista.error)}
        </Aviso>
      ) : lista.hasNextPage ? (
        <div className="fc-acessos-mais">
          <Botao carregando={lista.isFetchingNextPage} onClick={() => void lista.fetchNextPage()}>
            Carregar mais eventos
          </Botao>
        </div>
      ) : null}
    </section>
  );
}
