import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ApiError } from '../../api';
import { Notice, Button, Card, TextField, Loading, Skeleton, Text, textClasses } from '../../design-system';
import { useUpdateSecuritySettings, useSecuritySettings, type SecuritySettings } from './queries';
import { SaveSecurityDialog } from './SaveSecurityDialog';
import { InfoIcon, ResetDefaultIcon } from './icons';
import { saveError, queryErrorMessage } from './messages';
import {
  FIELDS,
  GROUPS,
  parameterHelp,
  changedFields,
  bodyOf,
  schemaOf,
  valuesOf,
  type SecurityField,
  type FormValues,
} from './parameters';
import './security.css';

/** Why "Salvar" is disabled: nothing changed. */
export const NO_CHANGES_REASON = 'Altere algum parâmetro para salvar';
/** Why "Voltar ao padrão" is disabled on a field. */
export const ALREADY_DEFAULT_REASON = 'O valor já é o padrão';
export const SAVED_MESSAGE = 'Parâmetros de segurança salvos.';
export const SYSTEM_NOTE =
  'O bloqueio de login após tentativas erradas e o limite de tentativas por IP não aparecem aqui: valem para o sistema ' +
  'inteiro, porque o login acontece antes de se saber o tenant. Para mudá-los, fale com quem opera o sistema.';

/**
 * Admin › Security: the five tenant session and password parameters, with each one's default and bounds,
 * "Voltar ao padrão" per field and save with confirmation. Needs `ApiProvider`, `QueryClientProvider` and
 * `FluxoRoot` (dialog portal).
 */
export function Security() {
  const titleId = useId();
  const query = useSecuritySettings();
  const settings = query.data;
  const noPermission = query.error instanceof ApiError && query.error.code === 'sem_permissao';

  return (
    <section className="fc-security" aria-labelledby={titleId}>
      <header className="fc-security-title">
        <Text as="h2" variant="heading-24" id={titleId}>
          Segurança
        </Text>
        <Text as="p" variant="label-14" emphasis="secondary">
          Sessão, senha e incorporação neste tenant
        </Text>
      </header>

      {settings ? (
        <SecurityForm settings={settings} />
      ) : query.isPending ? (
        <SecuritySkeleton />
      ) : (
        <Notice
          type="error"
          title="Não foi possível carregar os parâmetros de segurança"
          actions={
            noPermission ? undefined : (
              <Button size="small" onClick={() => void query.refetch()} loading={query.isFetching}>
                Tentar de novo
              </Button>
            )
          }
        >
          {queryErrorMessage(query.error)}
        </Notice>
      )}

      {query.isError && settings !== undefined ? (
        <Notice
          type="error"
          title="Não foi possível atualizar os parâmetros"
          actions={
            <Button size="small" onClick={() => void query.refetch()} loading={query.isFetching}>
              Tentar de novo
            </Button>
          }
        >
          {queryErrorMessage(query.error)}
        </Notice>
      ) : null}

      <p className={`fc-security-note ${textClasses({ variant: 'label-13', emphasis: 'secondary' })}`}>
        <InfoIcon size={14} />
        <span>{SYSTEM_NOTE}</span>
      </p>
    </section>
  );
}

/** Skeleton with the shape of the form: three groups, five fields. */
function SecuritySkeleton() {
  return (
    <Card>
      <Loading label="Carregando os parâmetros de segurança">
        {GROUPS.map((group) => (
          <div key={group.title} className="fc-security-skeleton-group">
            <Skeleton width={80} />
            {group.parameters.map((parameter) => (
              <div key={parameter.field} className="fc-security-skeleton-field">
                <Skeleton width={180} />
                <Skeleton width={240} />
              </div>
            ))}
          </div>
        ))}
      </Loading>
    </Card>
  );
}

interface Confirmation {
  newOnes: Record<SecurityField, number>;
  changed: SecurityField[];
}

function isDefault(text: string, defaultValue: number): boolean {
  return /^-?\d+$/.test(text.trim()) && Number(text.trim()) === defaultValue;
}

function SecurityForm({ settings }: { settings: SecuritySettings }) {
  const saveButton = useRef<HTMLButtonElement>(null);
  const schema = useMemo(() => schemaOf(settings), [settings]);
  const serverValues = useMemo(() => valuesOf(settings), [settings]);
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    reset,
    getValues,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: serverValues,
  });

  // When the values in force change (someone else saved and the query was refetched), the fields the person did not
  // edit start showing them; what they typed stays.
  const previousServer = useRef(serverValues);
  useEffect(() => {
    const previous = previousServer.current;
    previousServer.current = serverValues;
    for (const field of FIELDS) {
      if (previous[field] !== serverValues[field] && getValues(field) === previous[field]) setValue(field, serverValues[field]);
    }
  }, [serverValues, getValues, setValue]);

  const update = useUpdateSecuritySettings();
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [saved, setSaved] = useState(false);
  const [generalError, setGeneralError] = useState<string | undefined>(undefined);

  const values = watch();
  const changed = changedFields(values, settings);
  const dirty = changed.length > 0;

  // The dialog has no Radix trigger (it opens on form submit): focus goes back by hand, after it closes.
  function afterClose(action: () => void) {
    setTimeout(action, 0);
  }

  const submit = handleSubmit((data) => {
    const changed = changedFields(data, settings);
    if (changed.length === 0) return;
    update.reset();
    setSaved(false);
    setGeneralError(undefined);
    setConfirmation({ newOnes: bodyOf(data), changed: changed });
  });

  function confirm() {
    if (!confirmation) return;
    update.mutate(confirmation.newOnes, {
      onSuccess: (saved) => {
        // The fields start showing what the server saved (" 1 " becomes "1").
        reset(valuesOf(saved));
        setConfirmation(null);
        setSaved(true);
        afterClose(() => saveButton.current?.focus());
      },
      onError: (error) => {
        const screen = saveError(error);
        const fields = FIELDS.filter((field) => screen.fields[field] !== undefined);
        // Without a field error (permission, CSRF, network…), the dialog stays open, with the note, to try again.
        if (fields.length === 0) return;
        setConfirmation(null);
        setGeneralError(screen.message);
        afterClose(() => {
          fields.forEach((field, index) =>
            setError(field, { type: 'api', message: screen.fields[field] }, { shouldFocus: index === 0 }),
          );
        });
      },
    });
  }

  function closeConfirmation() {
    setConfirmation(null);
    afterClose(() => saveButton.current?.focus());
  }

  const dialogError = update.isError && confirmation ? saveError(update.error).message : undefined;

  return (
    <>
      <form className="fc-security-form" onSubmit={submit} noValidate>
        <Card padding="none" className="fc-security-box">
          {GROUPS.map((group) => (
            <fieldset key={group.title} className="fc-security-group">
              <legend className={`fc-security-caption ${textClasses({ variant: 'heading-14' })}`}>{group.title}</legend>
              {group.parameters.map((parameter) => {
                const { field } = parameter;
                const defaultValue = settings[field].padrao;
                return (
                  <div key={field} className="fc-security-parameter">
                    <TextField
                      className="fc-security-field"
                      label={`${parameter.label} (${parameter.unit})`}
                      inputMode="numeric"
                      autoComplete="off"
                      tooltip={parameterHelp(settings[field])}
                      error={errors[field]?.message}
                      {...register(field)}
                    />
                    <Button
                      variant="ghost"
                      size="small"
                      className="fc-security-reset"
                      icon={<ResetDefaultIcon size={14} />}
                      aria-label={`Voltar ao padrão: ${parameter.label}`}
                      disabledReason={isDefault(values[field], defaultValue) ? ALREADY_DEFAULT_REASON : undefined}
                      onClick={() => setValue(field, String(defaultValue), { shouldDirty: true, shouldValidate: true })}
                    >
                      Voltar ao padrão
                    </Button>
                  </div>
                );
              })}
            </fieldset>
          ))}

          <div className="fc-security-footer">
            {generalError ? <Notice type="error">{generalError}</Notice> : null}
            {saved && !dirty ? <Notice type="success">{SAVED_MESSAGE}</Notice> : null}
            <div className="fc-security-actions">
              <Button
                ref={saveButton}
                type="submit"
                variant="primary"
                disabledReason={dirty ? undefined : NO_CHANGES_REASON}
                showReason="beside"
              >
                Salvar
              </Button>
            </div>
          </div>
        </Card>
      </form>

      {/* Outside the <form>: the dialog buttons take no part in submitting. */}
      {confirmation ? (
        <SaveSecurityDialog
          settings={settings}
          newOnes={confirmation.newOnes}
          changed={confirmation.changed}
          saving={update.isPending}
          error={dialogError}
          onConfirm={confirm}
          onClose={closeConfirmation}
        />
      ) : null}
    </>
  );
}
