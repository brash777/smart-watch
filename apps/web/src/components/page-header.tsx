import type { ReactNode } from 'react';

/** The title of a screen and, optionally, one line about it. */
export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="flex flex-col gap-1.5">
      <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
      {children === undefined ? null : <p className="text-muted">{children}</p>}
    </header>
  );
}
