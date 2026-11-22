import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { env } from '../../../config/env';

/** The frame of the login and sign-up screens: the app's name and promise, then the form. */
export function AuthShell({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-6 py-10">
      <header className="flex flex-col items-center gap-2 text-center">
        <p className="text-4xl font-bold">{env.appName}</p>
        <p>{t('app.tagline')}</p>
      </header>
      <section aria-labelledby="auth-title" className="flex flex-col gap-6">
        <h1 id="auth-title" className="text-2xl font-bold">
          {title}
        </h1>
        {children}
      </section>
      <footer className="text-center">{footer}</footer>
    </main>
  );
}
