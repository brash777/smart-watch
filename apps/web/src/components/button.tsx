import type { ButtonHTMLAttributes } from 'react';

/** The main action of a screen, as wide as its form. */
export function Button({
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-12 w-full items-center justify-center px-4 font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...props}
    />
  );
}
