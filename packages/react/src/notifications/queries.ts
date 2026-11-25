import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

/**
 * The tenant alerts (`GET /v1/notifications`, first page: the newest 20) with `unread_count`, fetched again every 30 s.
 * The refresh stops after a failed fetch, even with older data in the cache (ADR 0067): the bell says the update failed
 * and offers "Tentar de novo", which starts it again. Errors are `ApiError` (`403 no_permission`).
 */
export function useNotifications() {
  const client = useApiClient();
  return useQuery({
    queryKey: NOTIFICATION_LIST_KEY,
    queryFn: ({ signal }) => dataOrError(client.GET('/v1/notifications', { signal })),
    refetchInterval: (query) => (query.state.status === 'error' ? false : NOTIFICATIONS_REFRESH_MS),
  });
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
  queryClient.setQueryData<NotificationList>(NOTIFICATION_LIST_KEY, (list) => {
    if (!list) return list;
    const items = list.items.map((notification) =>
      notification.read ? notification : { ...notification, read: true },
    );
    return { ...list, items, unread_count: 0 };
  });
}

function refetchList(queryClient: QueryClient, mark: number | undefined) {
  if (!isSameSessionData(queryClient, mark)) return;
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
    mutationFn: () => dataOrError(client.POST('/v1/notifications/read', { body: { all: true } })),
    onMutate: () => stopRefresh(queryClient),
    onSuccess: (_data, _variables, mark) => {
      if (!isSameSessionData(queryClient, mark)) return;
      markAllInCache(queryClient);
    },
    onSettled: (_data, _error, _variables, mark) => refetchList(queryClient, mark),
  });
}
