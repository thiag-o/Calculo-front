import { Acessos } from './acessos';
import './auditoria.css';

/**
 * Tela de Auditoria. No épico 2 tem só a seção Acessos; o log de configuração entra quando houver o que registrar
 * (rotas e abas do módulo: F19). Precisa do `ProvedorApi`, do `QueryClientProvider` e da `RaizFluxo`.
 */
export function Auditoria() {
  return (
    <div className="fc-auditoria">
      <Acessos />
    </div>
  );
}
