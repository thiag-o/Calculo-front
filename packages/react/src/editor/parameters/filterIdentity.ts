// Who is who in the filters of a query of the allowed values, by object and not by position (ADR 0044; ADR 0047: each
// sub-vertical keeps its own WeakMap). An edited filter passes its key to the object that replaces it, so a filter keeps its
// React key, its problems (found in the analysed definition) and its merge key while the analysis is on the way.
import type { Schemas } from '../../api';

export type QueryFilter = Schemas['SourceFilter'];

const keys = new WeakMap<object, number>();
let lastKey = 0;

/** The key of the filter: the same for the object and for every edited version of it. */
export function filterKey(filter: QueryFilter): number {
  let key = keys.get(filter);
  if (key === undefined) {
    lastKey += 1;
    key = lastKey;
    keys.set(filter, key);
  }
  return key;
}

/** Where the filter is in `list`: the same object or an edited version of it. `-1` when it is not there. */
export function indexOfFilter(list: readonly QueryFilter[] | undefined, filter: QueryFilter): number {
  if (!list) return -1;
  const same = list.indexOf(filter);
  if (same >= 0) return same;
  const key = keys.get(filter);
  if (key === undefined) return -1;
  return list.findIndex((candidate) => keys.get(candidate) === key);
}

/** The list with `filter` replaced by `next`, which takes its key. */
export function replaceFilter(list: readonly QueryFilter[], filter: QueryFilter, next: QueryFilter): QueryFilter[] {
  const index = indexOfFilter(list, filter);
  if (index < 0) return [...list];
  const current = list[index]!;
  if (next !== current && !keys.has(next)) keys.set(next, filterKey(current));
  return list.map((item, at) => (at === index ? next : item));
}

/** The list without `filter`. */
export function removeFilter(list: readonly QueryFilter[], filter: QueryFilter): QueryFilter[] {
  const index = indexOfFilter(list, filter);
  return list.filter((_, at) => at !== index);
}
