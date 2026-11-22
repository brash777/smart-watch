import type { ReactNode } from 'react';

/** The title of a screen and, optionally, one line about it. */
export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="flex flex-col gap-1">
      <h1 className="text-2xl font-bold">{title}</h1>
      {children === undefined ? null : <p>{children}</p>}
    </header>
  );
}
