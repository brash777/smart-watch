import type { ButtonHTMLAttributes } from 'react';
import { buttonClassName, type ButtonStyle } from './button-styles';

/** The main action of a screen (primary), a secondary one or a destructive one. */
export function Button({
  variant,
  fullWidth,
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & ButtonStyle) {
  return (
    <button
      type={type}
      className={`${buttonClassName({ variant, fullWidth })} ${className}`}
      {...props}
    />
  );
}
