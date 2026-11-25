// Vertical "notifications" (ADR 0003).
// Bell: alerts, executions with errors and pending approvals.
// This file is the vertical's public interface; the rest of the folder is private.

// The bell (E7-27), placed by the module in the shell content bar and at the end of the embedded tab row. The links
// leave through the navigation callbacks, so this vertical does not import module/.
export { NotificationBell } from './NotificationBell';
export type { NotificationBellProps } from './NotificationBell';

// The cache keys of the alerts (`['notifications', …]`) and the refresh interval.
export { NOTIFICATIONS_KEY, NOTIFICATION_LIST_KEY, NOTIFICATIONS_REFRESH_MS } from './queries';
