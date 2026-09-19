import { t } from '../../lib/i18n.ts';

interface ConfirmDialogProps {
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  pending?: boolean;
}

export function ConfirmDialog({ message, confirmLabel, danger, onConfirm, onCancel, pending }: ConfirmDialogProps): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-space-lg">
      <div className="bg-surface-container-lowest rounded-2xl p-space-lg w-full max-w-sm shadow-lg">
        <p className="text-body-md font-body-md text-on-surface mb-space-lg">{message}</p>
        <div className="flex gap-space-sm justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="min-h-[44px] px-space-lg rounded-xl bg-surface-container text-on-surface text-label-md font-label-md disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={`min-h-[44px] px-space-lg rounded-xl text-label-md font-label-md disabled:opacity-50 ${
              danger === true ? 'bg-error text-on-error' : 'bg-primary text-on-primary'
            }`}
          >
            {confirmLabel ?? t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
