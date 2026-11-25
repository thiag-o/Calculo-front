import { type QueryClient, useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dataOrError, useApiClient, type Schemas } from '../api';
import { isSameSessionData, sessionDataMark } from '../session';

export type Notification = Schemas['Notification'];
export type NotificationList = Schemas['NotificationList'];

/** The bell asks the API again every 30 s (E7-27, E7-13). */
export const NOTIFICATIONS_REFRESH_MS = 30_000;

/** Every query of the vertical lives under this prefix. */
export const NOTIFICATIONS_KEY = ['notifications'] as const;
/** The first page of the alerts (the newest 20), with the unread count of the person. */
export const NOTIFICATION_LIST_KEY = [...NOTIFICATIONS_KEY, 'list'] as const;

/** The key of the two "marcar como lido" mutations: while one runs, the 30 s refresh waits. */
const MARKING_KEY = [...NOTIFICATIONS_KEY, 'marking'] as const;

/**
 * The tenant alerts (`GET /v1/notifications`, first page: the newest 20) with `unread_count`, fetched again every 30 s.
 * The refresh stops after a failed fetch, even with older data in the cache (ADR 0067): the bell says the update failed
 * and offers "Tentar de novo", which starts it again, and nothing else does (a "marcar como lido" leaves a list in error
 * as it is, see `listFailed`). It also waits while a "marcar como lido" is pending, so a refresh read before the marking
 * does not undo the alert read on screen. Errors are `ApiError` (`403 no_permission`).
 */
export function useNotifications() {
  const client = useApiClient();
  const marking = useIsMutating({ mutationKey: MARKING_KEY }) > 0;
  return useQuery({
    queryKey: NOTIFICATION_LIST_KEY,
    queryFn: ({ signal }) => dataOrError(client.GET('/v1/notifications', { signal })),
    refetchInterval: (query) => (query.state.status === 'error' || marking ? false : NOTIFICATIONS_REFRESH_MS),
  });
}

/**
 * Whether the list is in error (its last fetch failed). Writing it or reading it again would turn it back to `success` and
 * start the refresh again, behind the back of the bell, which shows the failure and has "Tentar de novo" for that (ADR 0067).
 */
function listFailed(queryClient: QueryClient): boolean {
  return queryClient.getQueryState(NOTIFICATION_LIST_KEY)?.status === 'error';
}

/**
 * Before marking: takes the session data mark (ADR 0049) and cancels a refresh in flight, so an answer read before the
 * marking does not bring the alert back as unread.
 */
async function stopRefresh(queryClient: QueryClient) {
  const mark = sessionDataMark(queryClient);
  await queryClient.cancelQueries({ queryKey: NOTIFICATION_LIST_KEY, exact: true });
  return mark;
}

/** Writes the list with the given alerts read; the unread count goes down by the ones that were unread. */
function markInCache(queryClient: QueryClient, read: (notification: Notification) => boolean) {
  if (listFailed(queryClient)) return;
  queryClient.setQueryData<NotificationList>(NOTIFICATION_LIST_KEY, (list) => {
    if (!list) return list;
    let newlyRead = 0;
    const items = list.items.map((notification) => {
      if (notification.read || !read(notification)) return notification;
      newlyRead += 1;
      return { ...notification, read: true };
    });
    return { ...list, items, unread_count: Math.max(0, list.unread_count - newlyRead) };
  });
}

/** Writes the list with every alert read and no unread left: `{all: true}` reaches the alerts beyond this page too. */
function markAllInCache(queryClient: QueryClient) {
  if (listFailed(queryClient)) return;
  queryClient.setQueryData<NotificationList>(NOTIFICATION_LIST_KEY, (list) => {
    if (!list) return list;
    const items = list.items.map((notification) =>
      notification.read ? notification : { ...notification, read: true },
    );
    return { ...list, items, unread_count: 0 };
  });
}

/** Reads the list again once a marking is settled (a failure brings the alert back as unread), unless the list is in error. */
function refetchList(queryClient: QueryClient, mark: number | undefined) {
  if (!isSameSessionData(queryClient, mark) || listFailed(queryClient)) return;
  void queryClient.invalidateQueries({ queryKey: NOTIFICATION_LIST_KEY, exact: true });
}

/**
 * Marks one alert as read (`POST /v1/notifications/read` with `{ids: [id]}`), when it is opened. The cache changes at
 * once (the person is already on the way to the execution); the list is fetched again when the answer arrives, so a
 * failure brings the alert back as unread.
 */
export function useMarkNotificationRead() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: MARKING_KEY,
    mutationFn: (id: string) =>
      dataOrError(client.POST('/v1/notifications/read', { body: { ids: [id] } })),
    onMutate: async (id) => {
      const mark = await stopRefresh(queryClient);
      if (isSameSessionData(queryClient, mark)) markInCache(queryClient, (notification) => notification.id === id);
      return mark;
    },
    onSettled: (_data, _error, _id, mark) => refetchList(queryClient, mark),
  });
}

/**
 * "Marcar todos como lidos" (`POST /v1/notifications/read` with `{all: true}`): all the tenant alerts, in every page.
 * The cache changes only after the `204`; an error stays with the caller (the bell shows it).
 */
export function useMarkAllNotificationsRead() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: MARKING_KEY,
    mutationFn: () => dataOrError(client.POST('/v1/notifications/read', { body: { all: true } })),
    onMutate: () => stopRefresh(queryClient),
    onSuccess: (_data, _variables, mark) => {
      if (!isSameSessionData(queryClient, mark)) return;
      markAllInCache(queryClient);
    },
    onSettled: (_data, _error, _variables, mark) => refetchList(queryClient, mark),
  });
}
