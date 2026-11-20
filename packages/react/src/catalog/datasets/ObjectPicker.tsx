import { useEffect, useId, useState } from 'react';
import { ApiError } from '../../api';
import { Notice, Button, Badge, FieldMessage, Loading, TextField, Text, textClasses } from '../../design-system';
import { useConnectionObjects, type DatabaseObject } from './queries';
import { isCredentialUnreadable } from '../errors';
import { UNKNOWN_CONNECTION_MESSAGE, queryErrorMessage } from './messages';
import { UnreadableCredentialNotice } from './UnreadableCredentialNotice';

/** How long the filter waits after the last key before asking the API (ms). */
export const SEARCH_DELAY_MS = 300;

/** The chosen object: schema and name. */
export type ChosenObject = Pick<DatabaseObject, 'schema_name' | 'name'>;

const OBJECT_TYPE_LABELS: Readonly<Record<DatabaseObject['type'], string>> = { table: 'Tabela', view: 'View' };

export interface ObjectPickerProps {
  connectionId: string;
  value: ChosenObject | null;
  onChange: (object: ChosenObject) => void;
  /** Field error ("Escolha uma tabela ou view", `unknown_object`). */
  error?: string;
  /** Opens the connection, from the unreadable credential notice. */
  onOpenConnection?: (id: string) => void;
}

function sameObject(a: ChosenObject | null, b: ChosenObject): boolean {
  return a !== null && a.schema_name === b.schema_name && a.name === b.name;
}

/**
 * Browser of the tables and views a connection sees: "Filtrar por nome" (asks the API after a short pause) and
 * "Carregar mais" by cursor. One choice, as radio buttons (arrows move between them).
 */
export function ObjectPicker({ connectionId, value, onChange, error, onOpenConnection }: ObjectPickerProps) {
  const legendId = useId();
  const errorId = useId();
  const radioName = useId();
  const [typed, setTyped] = useState('');
  const [search, setSearch] = useState('');
  const objects = useConnectionObjects(connectionId, search);

  // The API is asked only after a pause in typing.
  useEffect(() => {
    const trimmed = typed.trim();
    const timer = setTimeout(() => setSearch(trimmed), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [typed]);

  const items = objects.data;
  const noPermission = objects.error instanceof ApiError && objects.error.code === 'no_permission';

  let content;
  if (objects.isPending) {
    content = <Loading label="Carregando tabelas e views" rows={4} />;
  } else if (objects.isError && items === undefined && isCredentialUnreadable(objects.error)) {
    content = (
      <UnreadableCredentialNotice
        message={queryErrorMessage(objects.error, UNKNOWN_CONNECTION_MESSAGE)}
        connectionId={connectionId}
        onOpenConnection={onOpenConnection}
      />
    );
  } else if (objects.isError && items === undefined) {
    content = (
      <Notice
        type="error"
        title="Não foi possível listar as tabelas e views"
        actions={
          noPermission ? undefined : (
            <Button size="small" loading={objects.isFetching} onClick={() => void objects.refetch()}>
              Tentar de novo
            </Button>
          )
        }
      >
        {queryErrorMessage(objects.error, UNKNOWN_CONNECTION_MESSAGE)}
      </Notice>
    );
  } else if (!items || items.length === 0) {
    content = (
      <Text as="p" variant="label-13" emphasis="secondary" className="fc-datasets-objects-empty">
        {search
          ? `Nenhuma tabela ou view com “${search}” no nome.`
          : 'Nenhuma tabela ou view visível para o usuário desta conexão.'}
      </Text>
    );
  } else {
    content = (
      <>
        <div className="fc-datasets-objects">
          {items.map((object) => {
            const label = `${object.schema_name}.${object.name}`;
            const chosen = sameObject(value, object);
            return (
              <label key={label} className={chosen ? 'fc-datasets-object-option fc-datasets-object-chosen' : 'fc-datasets-object-option'}>
                <input
                  type="radio"
                  name={radioName}
                  className="fc-datasets-radio"
                  checked={chosen}
                  onChange={() => onChange({ schema_name: object.schema_name, name: object.name })}
                />
                <span className={`fc-datasets-object-name ${textClasses({ variant: 'mono-13' })}`}>{label}</span>
                {/* The space separates the words in the accessible name ("public.produtos Tabela"). */}{' '}
                <Badge>{OBJECT_TYPE_LABELS[object.type]}</Badge>
              </label>
            );
          })}
        </div>
        {objects.isFetchNextPageError ? (
          <Notice type="error" title="Não foi possível carregar mais tabelas e views">
            {queryErrorMessage(objects.error, UNKNOWN_CONNECTION_MESSAGE)}
          </Notice>
        ) : null}
        {objects.hasNextPage ? (
          <div>
            <Button size="small" loading={objects.isFetchingNextPage} onClick={() => void objects.fetchNextPage()}>
              Carregar mais
            </Button>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <fieldset
      className="fc-datasets-picker"
      aria-labelledby={legendId}
      aria-describedby={error ? errorId : undefined}
      aria-busy={objects.isFetching || undefined}
    >
      <legend id={legendId} className={`fc-datasets-legend ${textClasses({ variant: 'label-13', emphasis: 'secondary' })}`}>
        Tabela ou view
      </legend>
      <TextField
        type="search"
        label="Filtrar por nome"
        autoComplete="off"
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        onKeyDown={(event) => {
          // The filter sits inside the new dataset form: Enter filters right away and never submits the form.
          if (event.key !== 'Enter') return;
          event.preventDefault();
          setSearch(typed.trim());
        }}
      />
      {content}
      {error ? (
        <FieldMessage id={errorId} type="error">
          {error}
        </FieldMessage>
      ) : null}
    </fieldset>
  );
}
