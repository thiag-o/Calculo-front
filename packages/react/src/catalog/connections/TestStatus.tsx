import { Notice, Status, Text, textClasses } from '../../design-system';
import { dateTime, duration, yesNo } from './format';
import type { ConnectionTestResult } from './queries';

export interface TestStatusProps {
  /** The last test of the connection; `null` when it was never tested. */
  test: ConnectionTestResult | null;
}

/**
 * The last test as dot + word (estilos.md §1.4 and §7.5): "ok", "falhou" or "não testada", with the date beside it. Only the
 * dot, the word and the date: the details (version, TLS, read-only, time) show only in the result of "Testar" (D34 of the back).
 */
export function TestStatus({ test }: TestStatusProps) {
  if (!test) return <Status tone="gray">não testada</Status>;
  const when = dateTime(test.tested_at);
  return (
    <span className="fc-connections-test-status">
      <Status tone={test.ok ? 'green' : 'red'}>{test.ok ? 'ok' : 'falhou'}</Status>
      {when ? (
        <Text variant="label-13" emphasis="secondary" className="fc-connections-number">
          {when}
        </Text>
      ) : null}
    </span>
  );
}

export interface TestResultProps {
  result: ConnectionTestResult;
}

/**
 * The result of the "Testar" button: dot + word and date, the error message (a fixed text of the API, shown as it comes) and
 * what was checked: server version, TLS, read-only and time. What was not checked (or is hidden without
 * `credentials.manage`) comes `null` and does not show.
 */
export function TestResult({ result }: TestResultProps) {
  const details: { label: string; value: string; mono?: boolean }[] = [];
  if (result.server_version !== null) details.push({ label: 'Versão', value: result.server_version, mono: true });
  if (result.tls !== null) details.push({ label: 'TLS', value: yesNo(result.tls) });
  if (result.read_only !== null) details.push({ label: 'Somente leitura', value: yesNo(result.read_only) });
  if (result.duration_ms !== null) details.push({ label: 'Tempo', value: duration(result.duration_ms) });

  return (
    <div className="fc-connections-result">
      <Text as="p" variant="label-13" emphasis="secondary">
        Resultado do teste
      </Text>
      <TestStatus test={result} />
      {details.length > 0 ? (
        <dl className="fc-connections-pairs">
          {details.map((detail) => (
            <div key={detail.label} className="fc-connections-pair">
              <dt className={textClasses({ variant: 'label-13', emphasis: 'secondary' })}>{detail.label}</dt>
              <dd className={`fc-connections-wrap ${textClasses({ variant: detail.mono ? 'mono-13' : 'label-14' })}`}>
                {detail.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {result.error ? <Notice type="error">{result.error.message}</Notice> : null}
    </div>
  );
}
