// Objects kept by id between renders, so React Flow (and the `memo` of the nodes) sees the same node or link object while
// nothing it shows changed (ADR 0044).
import { useEffect, useRef } from 'react';

/** Objects kept by id while what they are made of (`parts`) stays the same. */
export type KeptObjects<T> = Map<string, { parts: readonly unknown[]; value: T }>;

/** The kept object of `id` when its parts are the same objects as before; otherwise a new one, kept from now on. */
export function keep<T>(cache: KeptObjects<T>, id: string, parts: readonly unknown[], make: () => T): T {
  const hit = cache.get(id);
  if (hit && hit.parts.length === parts.length && hit.parts.every((part, index) => Object.is(part, parts[index]))) return hit.value;
  const value = make();
  cache.set(id, { parts, value });
  return value;
}

/** Forgets the ids that are gone from the list (a removed block, a link that no longer exists). */
export function prune<T extends { id: string }>(cache: KeptObjects<T>, list: readonly T[]): void {
  const present = new Set(list.map((item) => item.id));
  for (const id of cache.keys()) if (!present.has(id)) cache.delete(id);
}

/** The previous list when every item is the same object as before; otherwise the next. */
export function sameList<T>(previous: T[] | null, next: T[]): T[] {
  if (previous && previous.length === next.length && next.every((item, index) => item === previous[index])) return previous;
  return next;
}

/** The list after an update of the kept objects: pruned of the ids that are gone, and the previous list when nothing changed. */
export function settle<T extends { id: string }>(cache: KeptObjects<T>, previous: T[] | null, next: T[]): T[] {
  prune(cache, next);
  return sameList(previous, next);
}

/**
 * The list with the identity of the last one drawn while no item changed. Render stays pure: the cache is pruned and the
 * list remembered after the commit, not while the list is being built.
 */
export function useStableList<T extends { id: string }>(cache: KeptObjects<T>, next: T[]): T[] {
  const previous = useRef<T[] | null>(null);
  const stable = sameList(previous.current, next);
  useEffect(() => {
    previous.current = stable;
    prune(cache, stable);
  });
  return stable;
}
