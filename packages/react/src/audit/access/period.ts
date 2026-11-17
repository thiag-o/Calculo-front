// Filter period: "De" and "Até" come from the browser date picker (`yyyy-mm-dd`) and become instants in the user's time
// zone. The API `since` is inclusive and `until` is exclusive, so "Até" becomes the start of the next day: the last day
// is fully included (answer D3 of F18).

const DAY_FORMAT = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The start of the day (`yyyy-mm-dd`) in the local time zone, adding `days`; `undefined` if the day does not exist. */
function localStartOfDay(day: string, days = 0): Date | undefined {
  const parts = DAY_FORMAT.exec(day);
  if (!parts) return undefined;
  const [year, month, formatNumber] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  const data = new Date(year, month - 1, formatNumber);
  // Rejects days that Date "fixes" (31/02 becomes 03/03).
  if (data.getFullYear() !== year || data.getMonth() !== month - 1 || data.getDate() !== formatNumber) return undefined;
  data.setDate(data.getDate() + days);
  return data;
}

/** Whether the value is a complete and valid day (`yyyy-mm-dd`). */
export function validDay(day: string): boolean {
  return localStartOfDay(day) !== undefined;
}

/** API `since`: the start of the "De" day, in the local time zone, as ISO 8601. */
export function sinceParam(day: string): string | undefined {
  return localStartOfDay(day)?.toISOString();
}

/** API `until` (exclusive): the start of the day after "Até", in the local time zone, as ISO 8601. */
export function untilParam(day: string): string | undefined {
  return localStartOfDay(day, 1)?.toISOString();
}

/** Whether "De" comes after "Até" (both filled). The same day in both is a one-day period. */
export function invertedPeriod(from: string, until: string): boolean {
  return validDay(from) && validDay(until) && from > until;
}
