// Vertical "design-system" (ADR 0003).
// Tokens --fc-* (claro/escuro), tipografia e componentes base. Vertical compartilhada: não depende de nenhuma outra.
// Este arquivo é a interface pública da vertical; o resto da pasta é privado.
export { RaizFluxo, usePortalFluxo } from './raiz';
export type { RaizFluxoProps, TemaFluxo } from './raiz';
export { Texto, classesTexto, estilosTexto } from './tipografia';
export type { EstiloTexto, OpcoesTexto, TextoProps, TomTexto } from './tipografia';
export { Botao, CaixaSelecao, CampoSenha, CampoTexto, MensagemCampo, Rotulo, Selecao } from './formulario';
export type {
  BotaoProps,
  CaixaSelecaoProps,
  CampoSenhaProps,
  CampoTextoProps,
  ExibicaoMotivo,
  MensagemCampoProps,
  OpcaoSelecao,
  RotuloProps,
  SelecaoProps,
  TamanhoBotao,
  TipoCampoTexto,
  TipoMensagemCampo,
  VarianteBotao,
} from './formulario';
export { Aviso, Caixa, Carregando, Dialogo, Dica, Esqueleto, EstadoVazio, FecharDialogo, Menu, Selo, Status, Tabela } from './exibicao';
export type {
  AcaoMenu,
  AvisoProps,
  CaixaProps,
  CarregandoProps,
  ColunaTabela,
  CorSelo,
  CorStatus,
  DialogoProps,
  DicaProps,
  EspacoCaixa,
  EsqueletoProps,
  EstadoVazioProps,
  FecharDialogoProps,
  ItemMenu,
  LadoDica,
  MenuProps,
  SeloProps,
  SeparadorMenu,
  StatusProps,
  TabelaProps,
  TipoAviso,
} from './exibicao';
