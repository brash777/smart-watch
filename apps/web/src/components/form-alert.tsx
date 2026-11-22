import type { ReactNode } from 'react';

/** A form-level error, read out as soon as it appears. */
export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-sm">
      {children}
    </p>
  );
}
