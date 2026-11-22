import { useId, type InputHTMLAttributes, type Ref } from 'react';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Translated message shown under the field and linked to it. */
  error?: string | undefined;
  ref?: Ref<HTMLInputElement>;
}

/** A labelled input whose error is announced with it (aria-describedby). */
export function TextField({ label, error, ref, className = '', ...input }: TextFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        ref={ref}
        aria-invalid={error === undefined ? undefined : true}
        aria-describedby={error === undefined ? undefined : errorId}
        className={`min-h-12 w-full rounded-control border border-field-border bg-surface px-3 text-base text-ink aria-invalid:border-danger ${className}`}
        {...input}
      />
      {error === undefined ? null : (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
