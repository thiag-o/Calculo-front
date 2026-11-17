// Vertical "admin" (ADR 0003).
// Admin: users, roles, API keys and authorized domains, and the tenant security parameters.
// This file is the vertical's public interface; the rest of the folder is private.

// The whole screen, with the internal tabs, and the permission of each area. The module uses the same screen in the shell and in
// embedded mode, with the tabs bound to the routes, and the same permissions in the menu.
export { Admin, ADMIN_TAB_PERMISSIONS } from './Admin';
export type { AdminTab, AdminProps } from './Admin';

// Each area, standalone (the sub-verticals).
export { Users } from './users';
export { Roles } from './roles';
export { ApiKeys, AuthorizedDomains, Integration } from './integration';
export { Security } from './security';
