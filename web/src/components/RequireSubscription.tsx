import { useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { config } from '../lib/config.ts';
import { isInsideTelegram } from '../lib/telegram.ts';
import { getChannelRequiredSnapshot, subscribeChannelRequired } from '../lib/channelState.ts';
import { decideSubscriptionGate } from '../lib/subscriptionGate.ts';
import { useMe } from '../lib/queries.ts';
import { Skeleton } from './States.tsx';
import { SubscribeScreen } from './SubscribeScreen.tsx';

/**
 * Wraps the whole shop: nobody browses the catalog before joining the required
 * Telegram channel. The server is the authority (403 channel_required on every
 * customer endpoint); this only keeps the UI honest, because catalog reads go
 * straight to /public/* and never carry an Authorization header.
 */
export function RequireSubscription({ children }: { children: ReactNode }): JSX.Element {
  const flagged = useSyncExternalStore(subscribeChannelRequired, getChannelRequiredSnapshot);
  const { data: me, isLoading, isError } = useMe();

  const decision = decideSubscriptionGate({
    mock: config.mock,
    insideTelegram: isInsideTelegram(),
    isLoading,
    isError,
    me,
    flagged,
  });

  if (decision === 'loading') {
    return (
      <div className="flex flex-col gap-space-sm p-margin pt-space-xl">
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
    );
  }
  if (decision === 'gate') {
    return <SubscribeScreen channelUsername={me?.channel_username ?? null} />;
  }
  return <>{children}</>;
}
