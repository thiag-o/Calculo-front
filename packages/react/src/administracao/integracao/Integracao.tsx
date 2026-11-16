import { ChavesApi } from './ChavesApi';
import { DominiosAutorizados } from './DominiosAutorizados';
import './integracao.css';

/**
 * Administração › Integração: as chaves de API (para o backend do hospedeiro pedir tokens) e os domínios autorizados
 * (de onde o módulo incorporado pode chamar a API), em duas seções. Cada seção é uma área com a sua ação principal.
 * Precisa do `ProvedorApi`, do `QueryClientProvider` e da `RaizFluxo` (portais dos diálogos e menus).
 */
export function Integracao() {
  return (
    <div className="fc-integracao">
      <ChavesApi />
      <DominiosAutorizados />
    </div>
  );
}
