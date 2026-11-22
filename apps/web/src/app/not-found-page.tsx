import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { paths } from './paths';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-3xl font-bold tracking-tight">{t('notFound.title')}</h1>
      <Link
        to={paths.home}
        className="flex min-h-11 items-center font-semibold underline underline-offset-4"
      >
        {t('notFound.back')}
      </Link>
    </main>
  );
}
