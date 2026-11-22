import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BrandMark } from '../../../components/brand-mark';
import { env } from '../../../config/env';

/** The frame of the login and sign-up screens: the brand and its promise, then the form. */
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
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-10 px-6 py-10">
      <header className="flex flex-col items-center gap-3 text-center">
        <BrandMark className="size-20">
          <span className="size-5 rounded-full bg-ink" />
        </BrandMark>
        <p className="font-display text-5xl font-extrabold tracking-tight">{env.appName}</p>
        <p className="text-muted">{t('app.tagline')}</p>
      </header>
      <section aria-labelledby="auth-title" className="flex flex-col gap-6">
        <h1 id="auth-title" className="font-display text-2xl font-bold tracking-tight">
          {title}
        </h1>
        {children}
      </section>
      <footer className="text-center text-muted">{footer}</footer>
    </main>
  );
}
