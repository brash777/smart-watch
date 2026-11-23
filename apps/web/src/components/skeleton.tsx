/** A grey block in the shape of content that is still loading. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <span aria-hidden className={`block animate-pulse bg-line ${className}`} />;
}
