import { useId, type InputHTMLAttributes } from 'react'

export const INPUT =
  'w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-base text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-violet-500 aria-invalid:border-red-500'
export const PRIMARY_BUTTON = 'rounded-md bg-violet-600 px-4 py-2 font-medium text-white hover:bg-violet-500 disabled:opacity-60'
export const SECONDARY_BUTTON = 'rounded-md border border-neutral-700 px-4 py-2 text-neutral-200 hover:border-neutral-500 hover:text-white disabled:opacity-60'

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  /** Shown under the field, in red, and read with it. */
  error?: string
  /** A quieter line under the field, when there is no error. */
  hint?: string
}

/** A labelled text field, with its error or a hint under it. */
export function Field({ label, error, hint, ...input }: FieldProps) {
  const id = useId()
  const note = error ?? hint
  // The note is outside the label: inside, it would be part of the field's name.
  return (
    <div className="flex flex-col gap-1 text-sm">
      <label htmlFor={id} className="text-neutral-300">
        {label}
      </label>
      <input
        {...input}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={note ? `${id}-note` : undefined}
        className={INPUT}
      />
      {note && (
        <span id={`${id}-note`} className={error ? 'text-red-400' : 'text-xs text-neutral-500'}>
          {note}
        </span>
      )}
    </div>
  )
}

/** The error of a whole form, above its button; announced as it appears. */
export function FormError({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="text-sm text-red-400">
      {message}
    </p>
  ) : null
}
