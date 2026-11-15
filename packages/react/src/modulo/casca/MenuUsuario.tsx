import { Menu } from '../../design-system';
import { useSair, type Sessao } from '../../sessao';
import { useEncerrarSessao } from '../encerramento';
import { IconeSair } from '../icones';
import { Avatar } from './Avatar';

export interface MenuUsuarioProps {
  usuario: Sessao['usuario'];
  aoFalhar: (erro: Error) => void;
}

/**
 * Quem está logado, no rodapé do menu lateral, com o menu da conta ("Sair"). Depois de sair, o módulo encerra a
 * sessão e avisa o hospedeiro pelo `onSessaoExpirada` (no casca, a volta ao login).
 */
export function MenuUsuario({ usuario, aoFalhar }: MenuUsuarioProps) {
  const sair = useSair();
  const encerrar = useEncerrarSessao();

  return (
    <Menu
      alinhamento="inicio"
      itens={[
        {
          rotulo: 'Sair',
          icone: <IconeSair />,
          aoSelecionar: () => {
            if (sair.isPending) return;
            sair.mutate(undefined, { onSuccess: encerrar, onError: aoFalhar });
          },
        },
      ]}
      gatilho={
        <button
          type="button"
          className="fc-usuario"
          aria-label={`${usuario.nome}: opções da conta`}
          aria-busy={sair.isPending || undefined}
        >
          <Avatar nome={usuario.nome} tom="forte" />
          <span className="fc-usuario-texto">
            <span className="fc-usuario-nome">{usuario.nome}</span>
            <span className="fc-usuario-email">{usuario.email}</span>
          </span>
        </button>
      }
    />
  );
}
