import { Button, Card, EmptyState, Text } from '../design-system';
import './home.css';

const WORKFLOWS_REASON = 'Disponível quando os workflows chegarem ao módulo';
const EXECUTIONS_REASON = 'Disponível quando houver um workflow publicado';

/**
 * Home screen (estilos.md §16): "Precisa de você", "Workflows recentes" and "Execuções recentes".
 * No data yet: each section shows its designed empty state (§14). The data comes in the next epics.
 */
export function Home() {
  return (
    <div className="fc-home">
      <header className="fc-home-top">
        <div className="fc-home-title">
          <Text as="h1" variant="heading-24">
            Início
          </Text>
          <Text as="p" variant="label-14" emphasis="secondary">
            Nenhum workflow ainda
          </Text>
        </div>
        <Button variant="primary" disabledReason={WORKFLOWS_REASON} showReason="beside">
          Novo workflow
        </Button>
      </header>

      <section className="fc-home-section" aria-labelledby="fc-home-needs">
        <Text as="h2" variant="heading-16" id="fc-home-needs">
          Precisa de você
        </Text>
        <Card as="div">
          <EmptyState
            title="Nada precisa de você agora"
            description="Aprovações, execuções com erro e alertas aparecem aqui, do mais urgente."
          />
        </Card>
      </section>

      <section className="fc-home-section" aria-labelledby="fc-home-workflows">
        <Text as="h2" variant="heading-16" id="fc-home-workflows">
          Workflows recentes
        </Text>
        <Card as="div">
          <EmptyState
            title="Nenhum workflow ainda"
            description="Crie o primeiro workflow para começar a calcular."
            action={
              <Button size="small" disabledReason={WORKFLOWS_REASON} showReason="beside">
                Novo workflow
              </Button>
            }
          />
        </Card>
      </section>

      <section className="fc-home-section" aria-labelledby="fc-home-executions">
        <Text as="h2" variant="heading-16" id="fc-home-executions">
          Execuções recentes
        </Text>
        <Card as="div">
          <EmptyState
            title="Nenhuma execução ainda"
            description="Publique uma versão e execute o primeiro lote."
            action={
              <Button size="small" disabledReason={EXECUTIONS_REASON} showReason="beside">
                Executar lote
              </Button>
            }
          />
        </Card>
      </section>
    </div>
  );
}
