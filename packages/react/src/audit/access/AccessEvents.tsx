import { useQueryClient } from '@tanstack/react-query';
import { useId, useRef, useState } from 'react';
import { ApiError } from '../../api';
import {
  Notice,
  Button,
  TextField,
  EmptyState,
  Select,
  Status,
  Table,
  Text,
  type TableColumn,
  type SelectOption,
} from '../../design-system';
import { accessEventsListKey, NO_FILTERS, useAccessEventList, type AccessEvent, type AccessEventFilters } from './queries';
import { dateTime } from './dates';
import { EmptyFilterIcon, HistoryIcon } from './icons';
import { filterError, fieldError, INVERTED_PERIOD_MESSAGE, listErrorMessage } from './messages';
import { validDay, invertedPeriod } from './period';
import { typePresentation, EVENT_TYPES } from './eventTypes';
import './access-events.css';

/** Value of "Todos os tipos" in the filter (Radix Select does not accept an empty value). */
const ALL_TYPES = 'all';

const TYPE_OPTIONS: readonly SelectOption[] = [
  { value: ALL_TYPES, label: 'Todos os tipos' },
  ...EVENT_TYPES.map((type) => ({ value: type.type, label: type.label })),
];

const SUBTITLE = 'Logins, falhas, bloqueios e mudanças de acesso neste tenant';

function hasFilter(filters: AccessEventFilters): boolean {
  return filters.type !== null || filters.from !== '' || filters.until !== '';
}

function summary(total: number, hasMore: boolean, filtered: boolean): string {
  const howMany = total.toLocaleString('pt-BR');
  const count = total === 1 ? '1 evento' : `${howMany} eventos`;
  const base = hasMore ? `Mais de ${count}` : count;
  return filtered ? `${base} com esses filtros` : base;
}

const columns: readonly TableColumn<AccessEvent>[] = [
  {
    key: 'when',
    title: 'Quando',
    width: '176px',
    skeletonWidth: 128,
    cell: (event) => (
      <Text variant="label-14" className="fc-access-number">
        {dateTime(event.occurred_at)}
      </Text>
    ),
  },
  {
    key: 'event',
    title: 'Evento',
    skeletonWidth: 140,
    cell: (event) => {
      const type = typePresentation(event.type);
      return <Status tone={type.tone}>{type.label}</Status>;
    },
  },
  {
    key: 'who',
    title: 'Quem',
    skeletonWidth: 180,
    cell: (event) => (
      <Text variant="label-14" className="fc-access-wrap">
        {event.provided_email}
      </Text>
    ),
  },
  {
    key: 'ip',
    title: 'IP',
    skeletonWidth: 96,
    cell: (event) =>
      event.ip ? (
        <Text variant="mono-13" className="fc-access-wrap">
          {event.ip}
        </Text>
      ) : null,
  },
  {
    key: 'detail',
    title: 'Detalhe',
    skeletonWidth: 160,
    cell: (event) =>
      event.detail ? (
        <Text variant="label-14" emphasis="secondary" className="fc-access-wrap">
          {event.detail}
        </Text>
      ) : null,
  },
];

/**
 * Audit › Access: the tenant access events (sign-ins, failures, locks, sign-outs and access changes), from newest
 * to oldest, with filter by type and by period and "Carregar mais eventos" by cursor. The filters apply on
 * value change and take the list back to the first page. Needs `ApiProvider`, `QueryClientProvider` and
 * `FluxoRoot` (portal of the type filter list).
 */
export function AccessEvents() {
  const titleId = useId();
  const queryClient = useQueryClient();
  const typeFilter = useRef<HTMLButtonElement>(null);
  // What is in the fields and what applies to the list: an inverted period stays only in the fields, with the error, and the list
  // keeps the last valid period.
  const [fields, setFields] = useState<AccessEventFilters>(NO_FILTERS);
  const [filters, setFilters] = useState<AccessEventFilters>(NO_FILTERS);
  const list = useAccessEventList(filters);

  function change(newOnes: AccessEventFilters) {
    setFields(newOnes);
    const from = validDay(newOnes.from) ? newOnes.from : '';
    const until = validDay(newOnes.until) ? newOnes.until : '';
    // With the period inverted, the type still applies; the period stays at the last valid one until fixed.
    setFilters((current) => (invertedPeriod(from, until) ? { ...current, type: newOnes.type } : { type: newOnes.type, from, until }));
  }

  function clearFilters() {
    setFields(NO_FILTERS);
    setFilters(NO_FILTERS);
    // The action goes away with the new list: focus goes to the first filter.
    typeFilter.current?.focus();
  }

  const events = list.data;
  const filtered = hasFilter(filters);
  const noDataError = list.isError && events === undefined ? list.error : null;
  const noPermission = noDataError instanceof ApiError && noDataError.code === 'no_permission';
  const inverted = invertedPeriod(fields.from, fields.until);
  const sinceError = fieldError(noDataError, 'since');
  const untilError = inverted ? INVERTED_PERIOD_MESSAGE : fieldError(noDataError, 'until');
  const invalidCursor = list.error instanceof ApiError && list.error.code === 'invalid_cursor';

  const clearButton = (
    <Button size="small" variant="secondary" onClick={clearFilters}>
      Limpar filtros
    </Button>
  );

  return (
    <section className="fc-access" aria-labelledby={titleId}>
      <header className="fc-access-title">
        <Text as="h2" variant="heading-16" id={titleId}>
          Acessos
        </Text>
        <Text as="p" variant="label-14" emphasis="secondary">
          {events && events.length > 0 ? summary(events.length, list.hasNextPage, filtered) : SUBTITLE}
        </Text>
      </header>

      <div className="fc-access-filters" role="group" aria-label="Filtros dos eventos">
        <Select
          ref={typeFilter}
          className="fc-access-type-filter"
          label="Tipo de evento"
          options={TYPE_OPTIONS}
          value={fields.type ?? ALL_TYPES}
          onValueChange={(value) => change({ ...fields, type: value === ALL_TYPES ? null : value })}
        />
        <TextField
          className="fc-access-day-filter"
          label="De"
          type="date"
          value={fields.from}
          max={validDay(fields.until) ? fields.until : undefined}
          error={sinceError}
          onChange={(event) => change({ ...fields, from: event.target.value })}
        />
        <TextField
          className="fc-access-day-filter"
          label="Até"
          type="date"
          value={fields.until}
          min={validDay(fields.from) ? fields.from : undefined}
          error={untilError}
          onChange={(event) => change({ ...fields, until: event.target.value })}
        />
      </div>

      <Table
        caption="Eventos de acesso do tenant"
        columns={columns}
        rows={events}
        rowKey={(event) => event.id}
        loading={list.isPending}
        loadingRows={5}
        error={
          noDataError ? (
            <Notice
              type="error"
              title="Não foi possível carregar os eventos de acesso"
              actions={
                noPermission ? undefined : filterError(noDataError) ? (
                  clearButton
                ) : (
                  <Button size="small" onClick={() => void list.refetch()} loading={list.isFetching}>
                    Tentar de novo
                  </Button>
                )
              }
            >
              {listErrorMessage(noDataError)}
            </Notice>
          ) : undefined
        }
        empty={
          filtered ? (
            <EmptyState
              icon={<EmptyFilterIcon />}
              title="Nenhum evento com esses filtros"
              description="Mude o tipo ou o período, ou limpe os filtros para ver todos os eventos."
              action={clearButton}
            />
          ) : (
            <EmptyState
              icon={<HistoryIcon />}
              title="Nenhum evento de acesso ainda"
              description="Os logins e as mudanças de acesso deste tenant aparecem aqui."
            />
          )
        }
      />

      {list.isError && events !== undefined ? (
        <Notice
          type="error"
          title={list.isFetchNextPageError ? 'Não foi possível carregar mais eventos' : 'Não foi possível atualizar a lista'}
          actions={
            invalidCursor ? (
              <Button
                size="small"
                loading={list.isFetching}
                onClick={() => void queryClient.resetQueries({ queryKey: accessEventsListKey(filters), exact: true })}
              >
                Recarregar lista
              </Button>
            ) : (
              <Button
                size="small"
                loading={list.isFetching}
                onClick={() => void (list.isFetchNextPageError ? list.fetchNextPage() : list.refetch())}
              >
                Tentar de novo
              </Button>
            )
          }
        >
          {listErrorMessage(list.error)}
        </Notice>
      ) : list.hasNextPage ? (
        <div className="fc-access-more">
          <Button loading={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
            Carregar mais eventos
          </Button>
        </div>
      ) : null}
    </section>
  );
}
