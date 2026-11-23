import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './button';

/** What an empty list is for, and the action that fills it. */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 py-6">
      <p className="font-display text-xl font-bold tracking-tight">{title}</p>
      {children === undefined ? null : <p className="text-muted">{children}</p>}
      {action}
    </div>
  );
}

/** A failed read: what failed and a way to try again. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div role="alert" className="flex flex-col items-start gap-3 py-6">
      <p className="text-danger">{message}</p>
      {onRetry === undefined ? null : (
        <Button variant="secondary" fullWidth={false} onClick={onRetry}>
          {t('common.retry')}
        </Button>
      )}
    </div>
  );
}
