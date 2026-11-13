import { useEffect, type RefObject } from 'react'
import { ApiError } from '../api/client'

/** What went wrong with a form: messages for its fields, and one for the form itself. */
export interface FormErrors {
  fields: Record<string, string>
  form: string | null
}

export const NO_ERRORS: FormErrors = { fields: {}, form: null }

/**
 * Sorts what the API refused: a 422's messages go next to the given fields they are about, anything else above the
 * button (the API's message, e.g. a 409, or `fallback` when the server couldn't be reached).
 */
export function formErrors(error: unknown, fields: string[], fallback: string): FormErrors {
  if (!(error instanceof ApiError)) {
    return { fields: {}, form: error instanceof Error && error.message && !(error instanceof TypeError) ? error.message : fallback }
  }
  const known = Object.fromEntries(Object.entries(error.violations).filter(([field]) => fields.includes(field)))
  const others = Object.entries(error.violations).filter(([field]) => !fields.includes(field))
  if (Object.keys(known).length > 0 && others.length === 0) {
    return { fields: known, form: null }
  }
  return { fields: known, form: others.length > 0 ? others.map(([, message]) => message).join(' ') : error.message }
}

/**
 * After a failed submit, the first field with an error gets the focus: in an effect, once React has drawn the
 * errors (a frame later isn't always enough: React may render an update from an async handler after it).
 */
export function useFocusOnErrors(form: RefObject<HTMLFormElement | null>, errors: FormErrors): void {
  useEffect(() => {
    if (Object.keys(errors.fields).length > 0) {
      form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
    }
  }, [form, errors])
}
