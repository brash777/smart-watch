import type { ReactNode } from 'react';

/** A form-level error, read out as soon as it appears. */
export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
      {children}
    </p>
  );
}
