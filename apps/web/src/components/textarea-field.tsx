import { useId, type Ref, type TextareaHTMLAttributes } from 'react';

interface TextareaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  /** Shown after the label, e.g. "opcional". */
  hint?: string | undefined;
  /** Translated message shown under the field and linked to it. */
  error?: string | undefined;
  ref?: Ref<HTMLTextAreaElement>;
}

/** A labelled multi-line field whose error is announced with it (aria-describedby). */
export function TextareaField({
  label,
  hint,
  error,
  ref,
  className = '',
  rows = 3,
  ...textarea
}: TextareaFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {hint === undefined ? null : <span className="font-normal text-muted"> ({hint})</span>}
      </label>
      <textarea
        id={id}
        ref={ref}
        rows={rows}
        aria-invalid={error === undefined ? undefined : true}
        aria-describedby={error === undefined ? undefined : errorId}
        className={`w-full rounded-control border border-field-border bg-surface px-3 py-2.5 text-base text-ink aria-invalid:border-danger ${className}`}
        {...textarea}
      />
      {error === undefined ? null : (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
