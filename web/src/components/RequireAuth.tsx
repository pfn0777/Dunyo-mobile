import { useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { config } from '../lib/config.ts';
import { isInsideTelegram } from '../lib/telegram.ts';
import { getAuthInvalidSnapshot, subscribeAuthInvalid } from '../lib/authState.ts';
import { AuthErrorScreen } from './AuthErrorScreen.tsx';

export function RequireAuth({ children }: { children: ReactNode }): JSX.Element {
  const authInvalid = useSyncExternalStore(subscribeAuthInvalid, getAuthInvalidSnapshot);

  if (config.mock) {
    return <>{children}</>;
  }
  if (!isInsideTelegram() || authInvalid) {
    return <AuthErrorScreen />;
  }
  return <>{children}</>;
}
