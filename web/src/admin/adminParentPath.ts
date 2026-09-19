/** Where the back control of an admin screen leads when there is no in-app
 * history to pop — the bot's "Admin panel" button opens the Mini App straight
 * at /admin, so the back button must still have somewhere to go. One segment
 * up, and out of the panel entirely from its root. */
export function adminParentPath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '');
  if (trimmed === '/admin' || trimmed === '') {
    return '/profile';
  }
  const parent = trimmed.slice(0, trimmed.lastIndexOf('/'));
  return parent.startsWith('/admin') ? parent : '/admin';
}
