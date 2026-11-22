import { LoaderCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function FullScreenLoader() {
  const { t } = useTranslation();
  return (
    <div role="status" className="grid min-h-dvh place-items-center">
      <LoaderCircle aria-hidden className="size-7 animate-spin text-muted" />
      <span className="sr-only">{t('app.loading')}</span>
    </div>
  );
}
