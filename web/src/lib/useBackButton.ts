import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { showBackButton } from './telegram.ts';

/** True when the app pushed at least one entry itself, i.e. navigate(-1)
 * stays inside the Mini App. React Router's browser history keeps this
 * counter in history.state.idx and sets it to 0 on the session's first
 * entry (@remix-run/router createBrowserHistory). */
function hasInAppHistory(): boolean {
  const state = window.history.state as { idx?: number } | null;
  return (state?.idx ?? 0) > 0;
}

/** Back navigation used by the Telegram BackButton and by in-app back
 * controls. Falls back to an explicit parent route when there is nothing to
 * pop: the Mini App can be opened deep (the bot's "Admin panel" button opens
 * /admin directly), and a blind navigate(-1) does nothing there. */
export function useBackNavigation(fallbackPath: string): () => void {
  const navigate = useNavigate();
  return useCallback(() => {
    if (hasInAppHistory()) {
      navigate(-1);
      return;
    }
    navigate(fallbackPath, { replace: true });
  }, [navigate, fallbackPath]);
}

/** Shows the Telegram BackButton on a nested route and wires it to the same
 * back navigation the in-app back control uses. Cleans up (hides it) on
 * unmount. Returns the handler so a visible button can reuse it. */
export function useTelegramBackButton(fallbackPath: string): () => void {
  const goBack = useBackNavigation(fallbackPath);
  useEffect(() => showBackButton(goBack), [goBack]);
  return goBack;
}
