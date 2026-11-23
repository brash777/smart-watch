import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

/** Goes up one level, e.g. from a Space to the list of Spaces. */
export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="-ml-2 flex min-h-11 w-fit items-center gap-1 pr-2 text-sm font-medium text-muted hover:text-ink"
    >
      <ChevronLeft aria-hidden className="size-5" />
      {children}
    </Link>
  );
}
