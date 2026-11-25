import { useId } from 'react';
import { Checkbox, FieldMessage, Select, TextField, textClasses, type SelectOption } from '../../design-system';
import {
  LAST_NUMBERED_DAY,
  RECURRENCE_KINDS,
  WEEKDAYS,
  type MonthDay,
  type RecurrenceErrors,
  type RecurrenceFields,
} from './recurrence';

const LAST_DAY = 'last';

const DAY_OPTIONS: readonly SelectOption[] = [
  ...Array.from({ length: LAST_NUMBERED_DAY }, (_, index) => ({ value: String(index + 1), label: String(index + 1) })),
  { value: LAST_DAY, label: 'Último dia' },
];

function monthDay(value: string): MonthDay {
  return value === LAST_DAY ? 'last' : Number(value);
}

export interface RecurrenceFieldsetProps {
  fields: RecurrenceFields;
  onChange: (fields: RecurrenceFields) => void;
  errors: RecurrenceErrors;
  /** "Horário de America/Sao_Paulo", under the hour. */
  timeZoneNote: string;
  disabled?: boolean;
}

/**
 * The recurrence of a schedule (E7-24): Diária | Semanal | Mensal (a segmented control of native radios, estilos.md §7.2),
 * the hour (`HH:MM`, in the time zone of the system, shown as text), the weekdays or the day of the month, with "Último dia".
 */
export function RecurrenceFieldset({ fields, onChange, errors, timeZoneNote, disabled = false }: RecurrenceFieldsetProps) {
  const group = useId();
  const weekdaysError = useId();
  const patch = (next: Partial<RecurrenceFields>) => onChange({ ...fields, ...next });

  return (
    <fieldset className="fc-schedules-recurrence" disabled={disabled}>
      <legend className={`fc-schedules-legend ${textClasses({ variant: 'label-13', emphasis: 'secondary' })}`}>Recorrência</legend>
      <div className="fc-schedules-segmented" role="radiogroup" aria-label="Recorrência">
        {RECURRENCE_KINDS.map((option) => {
          const checked = fields.kind === option.value;
          return (
            <label
              key={option.value}
              className={`fc-schedules-segment ${textClasses({ variant: 'label-13' })}`}
              data-checked={checked || undefined}
              data-disabled={disabled || undefined}
            >
              <input
                type="radio"
                className="fc-schedules-segment-radio"
                name={group}
                checked={checked}
                disabled={disabled}
                onChange={() => patch({ kind: option.value })}
              />
              {option.label}
            </label>
          );
        })}
      </div>

      <div className="fc-schedules-recurrence-row">
        <TextField
          className="fc-schedules-time"
          label="Horário"
          placeholder="02:00"
          inputMode="numeric"
          autoComplete="off"
          value={fields.time}
          error={errors.time}
          tooltip={timeZoneNote}
          onChange={(event) => patch({ time: event.target.value })}
        />
        {fields.kind === 'monthly' ? (
          <Select
            className="fc-schedules-day"
            label="Dia do mês"
            options={DAY_OPTIONS}
            value={String(fields.day)}
            disabled={disabled}
            onValueChange={(value) => patch({ day: monthDay(value) })}
          />
        ) : null}
      </div>

      {fields.kind === 'weekly' ? (
        <fieldset className="fc-schedules-weekdays" aria-describedby={errors.weekdays ? weekdaysError : undefined}>
          <legend className={`fc-schedules-legend ${textClasses({ variant: 'label-13', emphasis: 'secondary' })}`}>Dias da semana</legend>
          <div className="fc-schedules-weekdays-list">
            {WEEKDAYS.map((weekday) => (
              <Checkbox
                key={weekday.day}
                label={weekday.label}
                checked={fields.weekdays.includes(weekday.day)}
                disabled={disabled}
                onCheckedChange={(checked) =>
                  patch({
                    weekdays:
                      checked === true
                        ? [...fields.weekdays, weekday.day]
                        : fields.weekdays.filter((day) => day !== weekday.day),
                  })
                }
              />
            ))}
          </div>
          {errors.weekdays ? (
            <FieldMessage id={weekdaysError} type="error">
              {errors.weekdays}
            </FieldMessage>
          ) : null}
        </fieldset>
      ) : null}
    </fieldset>
  );
}
