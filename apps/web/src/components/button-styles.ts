export type ButtonVariant = 'primary' | 'secondary' | 'danger';

export interface ButtonStyle {
  variant?: ButtonVariant;
  /** As wide as its container (the default), or as wide as its text. */
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-on-ink hover:opacity-90',
  secondary: 'border border-line bg-surface text-ink hover:border-field-border',
  danger: 'bg-danger text-on-ink hover:opacity-90',
};

/** The classes of a button, also for links that look like one. */
export function buttonClassName({
  variant = 'primary',
  fullWidth = true,
}: ButtonStyle = {}): string {
  return [
    'inline-flex min-h-12 items-center justify-center gap-2 rounded-control px-4 font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-60',
    fullWidth ? 'w-full' : '',
    variantClasses[variant],
  ].join(' ');
}
