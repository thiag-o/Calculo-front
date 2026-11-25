import * as Popover from '@radix-ui/react-popover';
import { useId, useState } from 'react';
import { Badge, Button, EmptyState, Loading, Notice, Skeleton, Status, Text, useFluxoPortal } from '../design-system';
import { relativeTime } from '../workflows';
import { BellIcon } from './icons';
import { KIND_TONE, badgeText, bellLabel, listErrorMessage, markAllErrorMessage } from './presentation';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications, type Notification } from './queries';
import './notifications.css';

export interface NotificationBellProps {
  /** Opens the execution of an alert (the module maps it to `/executions/:id`). */
  onOpenExecution: (executionId: string) => void;
  /**
   * Opens the Agendamentos tab of the alert's workflow: the destination of the schedule alerts that did not create an
   * execution (`schedule_failed`, `schedule_skipped`).
   */
  onOpenSchedules: (workflowId: string) => void;
}

/**
 * The bell (E7-27): icon-only button with the unread count in a neutral badge and the name "Alertas, 3 não lidos"; it
 * opens a popover (Radix, portal inside the module root, ADR 0011) with the newest alerts: dot + title, detail, when and
 * the link. Opening an alert marks it read and navigates; "Marcar todos como lidos" marks every one. The list is fetched
 * again every 30 s and stops after a failure (ADR 0067). Keyboard: Enter or Space opens; Esc closes and gives the focus
 * back to the button. The module shows it only with `executions.view`.
 */
export function NotificationBell({ onOpenExecution, onOpenSchedules }: NotificationBellProps) {
  const portal = useFluxoPortal();
  const [open, setOpen] = useState(false);
  const list = useNotifications();
  const markOne = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const titleId = useId();
  const unread = list.data?.unread_count;

  function changeOpen(next: boolean) {
    setOpen(next);
    // A failed "Marcar todos como lidos" is not shown again on the next opening.
    if (!next) markAll.reset();
  }

  function openAlert(notification: Notification) {
    if (!notification.read) markOne.mutate(notification.id);
    changeOpen(false);
    if (notification.execution) onOpenExecution(notification.execution.id);
    else onOpenSchedules(notification.workflow.id);
  }

  return (
    <Popover.Root open={open} onOpenChange={changeOpen}>
      <Popover.Trigger asChild>
        <button type="button" className="fc-notifications-bell" aria-label={bellLabel(unread)}>
          <BellIcon />
          {unread ? (
            <Badge className="fc-notifications-count" aria-hidden="true">
              {badgeText(unread)}
            </Badge>
          ) : null}
        </button>
      </Popover.Trigger>
      {portal && (
        <Popover.Portal container={portal}>
          <Popover.Content
            className="fc-notifications"
            align="end"
            sideOffset={4}
            collisionPadding={8}
            aria-labelledby={titleId}
          >
            <div className="fc-notifications-header">
              <Text as="h2" id={titleId} variant="heading-14">
                Alertas
              </Text>
              {list.data ? (
                <Button
                  size="small"
                  variant="ghost"
                  loading={markAll.isPending}
                  disabledReason={list.data.unread_count === 0 ? 'Todos os alertas já foram lidos' : undefined}
                  onClick={() => markAll.mutate()}
                >
                  Marcar todos como lidos
                </Button>
              ) : null}
            </div>

            {markAll.isError ? (
              <Notice type="error" title="Não foi possível marcar os alertas como lidos" className="fc-notifications-notice">
                {markAllErrorMessage(markAll.error)}
              </Notice>
            ) : null}

            {list.isError ? (
              <Notice
                type="error"
                title={list.data ? 'Não foi possível atualizar os alertas' : 'Não foi possível carregar os alertas'}
                className="fc-notifications-notice"
                actions={
                  <Button size="small" loading={list.isFetching} onClick={() => void list.refetch()}>
                    Tentar de novo
                  </Button>
                }
              >
                {listErrorMessage(list.error)}
              </Notice>
            ) : null}

            {list.isPending ? (
              <Loading label="Carregando alertas" className="fc-notifications-loading">
                {Array.from({ length: 3 }, (_, index) => (
                  <div key={index} className="fc-notifications-skeleton">
                    <Skeleton width={160} />
                    <Skeleton />
                    <Skeleton width={60} />
                  </div>
                ))}
              </Loading>
            ) : list.data && list.data.items.length === 0 ? (
              <EmptyState
                icon={<BellIcon />}
                title="Nenhum alerta"
                description="Execuções que precisam de você e agendamentos que não executaram aparecem aqui."
                className="fc-notifications-empty"
              />
            ) : list.data ? (
              <>
                <ul className="fc-notifications-list">
                  {list.data.items.map((notification) => (
                    <AlertItem key={notification.id} notification={notification} onOpen={openAlert} />
                  ))}
                </ul>
                {list.data.next_cursor ? (
                  <Text as="p" variant="label-12" emphasis="secondary" className="fc-notifications-more">
                    Mostrando os {list.data.items.length} alertas mais recentes.
                  </Text>
                ) : null}
              </>
            ) : null}
          </Popover.Content>
        </Popover.Portal>
      )}
    </Popover.Root>
  );
}

function AlertItem({ notification, onOpen }: { notification: Notification; onOpen: (notification: Notification) => void }) {
  const id = useId();
  const titleId = `${id}-titulo`;
  const unread = !notification.read;
  return (
    <li className={['fc-notifications-item', unread ? 'fc-notifications-item-unread' : null].filter(Boolean).join(' ')}>
      <Status tone={KIND_TONE[notification.kind]} id={titleId} className="fc-notifications-title">
        {notification.title}
      </Status>
      <Text as="p" variant="label-13" emphasis="secondary" className="fc-notifications-detail">
        {notification.detail}
      </Text>
      <div className="fc-notifications-meta">
        <Text variant="label-12" emphasis="secondary">
          <time dateTime={notification.created_at}>{relativeTime(notification.created_at)}</time>
          {unread ? ' · não lido' : null}
        </Text>
        <button type="button" className="fc-notifications-link" aria-describedby={titleId} onClick={() => onOpen(notification)}>
          {notification.execution ? 'Abrir execução' : 'Abrir agendamentos'}
        </button>
      </div>
    </li>
  );
}
