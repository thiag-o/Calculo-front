// Vertical "session" (ADR 0003).
// Shell app sign-in, embed token and permissions of the current user.
// This file is the vertical's public interface; the rest of the folder is private.

// Current session and permissions.
export { hasPermission, useSession } from './useSession';
export type { SessionResult, Session } from './useSession';

// Sign-in, sign-out and tenant switch.
export { useSignIn, useSignOut, useSwitchTenant } from './mutations';
export type { LoginCredentials } from './mutations';

// Shell app sign-in screen.
export { SignIn } from './sign-in/SignIn';
export type { SignInProps } from './sign-in/SignIn';

// Public new-password screen from the reset link.
export { ResetPassword } from './reset-password/ResetPassword';
export type { ResetPasswordProps } from './reset-password/ResetPassword';
