import type { ReactNode } from 'react';

/** A short confirmation, read out when it appears (e.g. after joining a Space). */
export function Notice({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="rounded-control border border-line bg-surface px-3 py-2 text-sm">
      {children}
    </p>
  );
}
