import * as Dialog from '@radix-ui/react-dialog';
import { useRef, type ReactElement, type ReactNode } from 'react';
import { Botao } from '../formulario';
import { usePortalFluxo } from '../raiz';
import { classesTexto } from '../tipografia';
import { IconeFechar } from './icones';
import './dialogo.css';

// Elementos que o Tab alcança (aproximação suficiente para decidir o foco inicial).
const focaveis =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface DialogoProps {
  /** Título (heading-16), um substantivo: "Ajustar valor". É o nome acessível do diálogo. */
  titulo: ReactNode;
  /** Texto abaixo do título, ligado por `aria-describedby`. */
  descricao?: ReactNode;
  /** Conteúdo (campos, texto). */
  children?: ReactNode;
  /**
   * Rodapé com as ações, alinhadas à direita: a principal por último ("Ajustar valor"; ação perigosa em vermelho).
   * Para fechar por um botão, envolva-o em `FecharDialogo`.
   */
  acoes?: ReactNode;
  /** Aberto (controlado). */
  aberto?: boolean;
  /** Aberto no início (não controlado). */
  abertoInicial?: boolean;
  /** Chamado ao abrir e ao fechar (Esc, clique fora, "Fechar" ou `FecharDialogo`). */
  aoMudarAberto?: (aberto: boolean) => void;
  /** Elemento que abre o diálogo (um `Botao`). Recebe o foco de volta ao fechar. */
  gatilho?: ReactElement;
  /** Classes extras do painel. */
  className?: string;
}

/**
 * Diálogo modal (Radix Dialog; estilos.md §7.7 e §4): raio 12px, título heading-16 e sombra de modal.
 * O portal fica no contêiner da raiz do módulo, nunca no `body` (ADR 0011); o foco fica preso dentro dele, Esc e o
 * botão "Fechar" fecham, e o foco volta ao gatilho. Abre com o foco no primeiro elemento focável do conteúdo ou das
 * ações; sem nenhum, no próprio painel.
 */
export function Dialogo({
  titulo,
  descricao,
  children,
  acoes,
  aberto,
  abertoInicial,
  aoMudarAberto,
  gatilho,
  className,
}: DialogoProps) {
  const portal = usePortalFluxo();
  const painel = useRef<HTMLDivElement>(null);
  // Sem descrição, o Radix pede aria-describedby explicitamente indefinido.
  const semDescricao = descricao ? {} : { 'aria-describedby': undefined };

  return (
    <Dialog.Root open={aberto} defaultOpen={abertoInicial} onOpenChange={aoMudarAberto}>
      {gatilho ? <Dialog.Trigger asChild>{gatilho}</Dialog.Trigger> : null}
      {portal && (
        <Dialog.Portal container={portal}>
          <Dialog.Overlay className="fc-dialogo-fundo" />
          <Dialog.Content
            ref={painel}
            className={['fc-dialogo', className].filter(Boolean).join(' ')}
            onOpenAutoFocus={(evento) => {
              // O Radix foca o primeiro focável. Se for só o "Fechar", a dica dele abriria no foco e o primeiro Esc
              // fecharia a dica, não o diálogo: nesse caso o foco vai para o próprio painel.
              const primeiro = painel.current?.querySelector<HTMLElement>(focaveis);
              if (painel.current && (!primeiro || primeiro.classList.contains('fc-dialogo-fechar'))) {
                evento.preventDefault();
                painel.current.focus();
              }
            }}
            {...semDescricao}
          >
            <div className="fc-dialogo-corpo">
              <div className="fc-dialogo-cabecalho">
                <Dialog.Title className={`fc-dialogo-titulo ${classesTexto({ estilo: 'heading-16' })}`}>{titulo}</Dialog.Title>
                {descricao ? (
                  <Dialog.Description className={`fc-dialogo-descricao ${classesTexto({ estilo: 'copy-14', tom: 'secundario' })}`}>
                    {descricao}
                  </Dialog.Description>
                ) : null}
              </div>
              {children}
            </div>
            {acoes ? <div className="fc-dialogo-acoes">{acoes}</div> : null}
            {/* Por último no DOM (no canto, pelo CSS): o foco inicial vai para o conteúdo, não para o "Fechar". */}
            <Dialog.Close asChild>
              <Botao soIcone variante="fantasma" tamanho="pequeno" rotulo="Fechar" icone={<IconeFechar />} className="fc-dialogo-fechar" />
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      )}
    </Dialog.Root>
  );
}

export interface FecharDialogoProps {
  /** Um `Botao` ("Cancelar"). O clique fecha o diálogo depois de chamar o `onClick` dele. */
  children: ReactElement;
}

/** Faz o botão filho fechar o diálogo em que está. */
export function FecharDialogo({ children }: FecharDialogoProps) {
  return <Dialog.Close asChild>{children}</Dialog.Close>;
}
