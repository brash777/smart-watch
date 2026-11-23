import type { UserSummary } from '@snapia/shared';

const sizes = { sm: 'size-8 text-xs', md: 'size-10 text-sm' } as const;

/** A person's profile photo, or their initial when they have none. Decorative: the name is next to it. */
export function Avatar({ user, size = 'md' }: { user: UserSummary; size?: keyof typeof sizes }) {
  const className = `${sizes[size]} shrink-0 rounded-full`;
  if (user.avatarUrl !== null) {
    return <img src={user.avatarUrl} alt="" className={`${className} object-cover`} />;
  }
  return (
    <span
      aria-hidden
      className={`${className} grid place-items-center bg-line font-semibold text-ink uppercase`}
    >
      {user.name.trim().charAt(0)}
    </span>
  );
}
