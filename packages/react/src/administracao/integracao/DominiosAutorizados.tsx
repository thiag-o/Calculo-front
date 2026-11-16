import { useId, useRef, useState } from 'react';
import { ErroApi } from '../../api';
import { Aviso, Botao, EstadoVazio, Menu, Tabela, Texto, type ColunaTabela } from '../../design-system';
import { useListaDominios, type DominioAutorizado } from './consultas';
import { dia } from './datas';
import { DialogoNovoDominio } from './DialogoNovoDominio';
import { DialogoRemoverDominio } from './DialogoRemoverDominio';
import { useFocoDeVolta } from './focoDeVolta';
import { IconeGlobo, IconeMaisAcoes } from './icones';
import { mensagemErroConsulta } from './mensagens';
import './integracao.css';

const ATRIBUTO_ACOES = 'data-fc-acoes-dominio';

type DialogoAberto = { tipo: 'novo' } | { tipo: 'remover'; dominio: DominioAutorizado };

function resumo(total: number): string {
  return total === 1 ? '1 domínio' : `${total.toLocaleString('pt-BR')} domínios`;
}

/**
 * Integração › Domínios autorizados: as origens que podem usar o módulo incorporado pelo navegador; cadastrar (com
 * validação da origem) e remover com confirmação. Precisa do `ProvedorApi`, do `QueryClientProvider` e da `RaizFluxo`.
 */
export function DominiosAutorizados() {
  const idTitulo = useId();
  const lista = useListaDominios();
  const secao = useRef<HTMLElement>(null);
  const botaoNovo = useRef<HTMLButtonElement>(null);
  const devolverFoco = useFocoDeVolta(secao, ATRIBUTO_ACOES, botaoNovo);
  const [dialogo, setDialogo] = useState<DialogoAberto | null>(null);

  function fechar() {
    const anterior = dialogo;
    setDialogo(null);
    devolverFoco(anterior?.tipo === 'remover' ? anterior.dominio.id : undefined);
  }

  const dominios = lista.data;
  const semPermissao = lista.error instanceof ErroApi && lista.error.codigo === 'sem_permissao';
  const novoDominio = (tamanho: 'pequeno' | 'padrao', variante: 'principal' | 'secundario', ref?: typeof botaoNovo) => (
    <Botao ref={ref} variante={variante} tamanho={tamanho} onClick={() => setDialogo({ tipo: 'novo' })}>
      Novo domínio
    </Botao>
  );

  const colunas: readonly ColunaTabela<DominioAutorizado>[] = [
    {
      chave: 'origem',
      titulo: 'Origem',
      larguraEsqueleto: 220,
      celula: (dominio) => (
        <Texto estilo="mono-13" medio className="fc-integracao-quebra">
          {dominio.origem}
        </Texto>
      ),
    },
    {
      chave: 'cadastrado',
      titulo: 'Cadastrado',
      largura: '120px',
      larguraEsqueleto: 80,
      celula: (dominio) => (
        <Texto estilo="label-14" className="fc-integracao-numero">
          {dia(dominio.criado_em)}
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
      celula: (dominio) => (
        <Menu
          gatilho={
            <Botao
              soIcone
              variante="fantasma"
              tamanho="pequeno"
              rotulo={`Mais ações para ${dominio.origem}`}
              icone={<IconeMaisAcoes />}
              data-fc-acoes-dominio={dominio.id}
            />
          }
          itens={[{ rotulo: 'Remover domínio', perigo: true, aoSelecionar: () => setDialogo({ tipo: 'remover', dominio }) }]}
        />
      ),
    },
  ];

  return (
    <section ref={secao} className="fc-integracao-secao" aria-labelledby={idTitulo}>
      <header className="fc-integracao-topo">
        <div className="fc-integracao-titulo">
          <Texto como="h2" estilo="heading-24" id={idTitulo}>
            Domínios autorizados
          </Texto>
          <Texto como="p" estilo="label-14" tom="secundario">
            {dominios ? resumo(dominios.length) : 'Origens que podem usar o módulo incorporado pelo navegador'}
          </Texto>
        </div>
        {novoDominio('padrao', 'principal', botaoNovo)}
      </header>

      <Tabela
        legenda="Domínios autorizados do tenant"
        colunas={colunas}
        linhas={dominios}
        chaveLinha={(dominio) => dominio.id}
        carregando={lista.isPending}
        linhasCarregando={2}
        erro={
          lista.isError && dominios === undefined ? (
            <Aviso
              tipo="erro"
              titulo="Não foi possível carregar os domínios autorizados"
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
            icone={<IconeGlobo />}
            titulo="Nenhum domínio autorizado ainda"
            descricao="Autorize a origem do sistema hospedeiro para o módulo incorporado funcionar nela."
            acao={novoDominio('pequeno', 'secundario')}
          />
        }
      />

      {lista.isError && dominios !== undefined ? (
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

      {dialogo?.tipo === 'novo' ? <DialogoNovoDominio aoFechar={fechar} /> : null}
      {dialogo?.tipo === 'remover' ? (
        <DialogoRemoverDominio key={dialogo.dominio.id} dominio={dialogo.dominio} aoFechar={fechar} />
      ) : null}
    </section>
  );
}
