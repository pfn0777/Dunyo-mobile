import { ApiError } from '../../lib/apiError.ts';
import { ErrorState } from '../../components/States.tsx';
import { AccessDenied } from './AccessDenied.tsx';

/** A query's error, routed to AccessDenied for 401/403 (any admin call coming
 * back unauthorized shows the same screen as the entry gate) and to the
 * generic retryable ErrorState otherwise. */
export function AdminErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }): JSX.Element {
  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
    return <AccessDenied />;
  }
  return <ErrorState onRetry={onRetry} />;
}
