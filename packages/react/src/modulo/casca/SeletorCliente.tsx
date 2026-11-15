import { Menu, type ItemMenu } from '../../design-system';
import { useTrocarTenant, type Sessao } from '../../sessao';
import { IconeTrocar, MarcaFluxo } from '../icones';
import { Avatar } from './Avatar';

export interface SeletorClienteProps {
  sessao: Sessao;
  /** A troca deu certo: o aviso de uma falha anterior pode sumir. */
  aoTrocar: () => void;
  aoFalhar: (erro: Error) => void;
}

/**
 * Seletor de contexto no topo do menu lateral (estilos.md §9, design.md §15): o cliente (tenant) atual, com ⇅.
 * Abre a lista dos clientes do usuário; escolher outro troca pelo `useTrocarTenant`. Com um cliente só, mostra o
 * nome sem botão, porque não há o que trocar.
 */
export function SeletorCliente({ sessao, aoTrocar, aoFalhar }: SeletorClienteProps) {
  const trocar = useTrocarTenant();
  const atual = sessao.tenant_atual;

  const identificacao = (
    <>
      <MarcaFluxo />
      <Avatar nome={atual.nome} tom="neutro" />
      <span className="fc-seletor-cliente-nome">{atual.nome}</span>
    </>
  );

  if (sessao.tenants.length <= 1) {
    return (
      <div className="fc-seletor-cliente">
        {identificacao}
        <span className="fc-modulo-oculto"> (cliente atual)</span>
      </div>
    );
  }

  const itens: ItemMenu[] = sessao.tenants.map((tenant) =>
    tenant.id === atual.id
      ? { rotulo: tenant.nome, motivoDesabilitado: 'Cliente atual', aoSelecionar: () => undefined }
      : {
          rotulo: tenant.nome,
          aoSelecionar: () => {
            if (trocar.isPending) return;
            trocar.mutate(tenant.id, { onSuccess: aoTrocar, onError: aoFalhar });
          },
        },
  );

  return (
    <Menu
      alinhamento="inicio"
      itens={itens}
      gatilho={
        <button
          type="button"
          className="fc-seletor-cliente fc-seletor-cliente-botao"
          aria-label={`Trocar cliente. Atual: ${atual.nome}`}
          aria-busy={trocar.isPending || undefined}
        >
          {identificacao}
          <span className="fc-seletor-cliente-trocar">
            <IconeTrocar />
          </span>
        </button>
      }
    />
  );
}
