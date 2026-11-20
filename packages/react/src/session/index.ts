// Vertical "session" (ADR 0003).
// Shell app sign-in, embed token and permissions of the current user.
// This file is the vertical's public interface; the rest of the folder is private.

// Current session and permissions.
export { hasPermission, useSession } from './useSession';
export type { SessionResult, Session } from './useSession';

// What leaves the module with the session (sign-out, 401, tenant switch, another person): the cache, the memories kept
// outside it (onSessionDataCleared), the screens mounted under the previous identity (useSessionGeneration) and the
// answers that arrive late (sessionDataMark and isSameSessionData, checked before writing to the cache).
export {
  clearSessionData,
  currentSession,
  isSameSessionData,
  onSessionDataCleared,
  replaceSessionInCache,
  sessionDataMark,
  useSessionGeneration,
} from './sessionCache';
export type { SessionDataListener } from './sessionCache';

// Sign-in, sign-out and tenant switch.
export { useSignIn, useSignOut, useSwitchTenant } from './mutations';
export type { LoginCredentials } from './mutations';

// Shell app sign-in screen.
export { SignIn } from './sign-in/SignIn';
export type { SignInProps } from './sign-in/SignIn';

// Public new-password screen from the reset link.
export { ResetPassword } from './reset-password/ResetPassword';
export type { ResetPasswordProps } from './reset-password/ResetPassword';
