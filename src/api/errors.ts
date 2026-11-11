/** An error response from the API, with the most useful message it gave. */
export class ApiError extends Error {
  readonly status: number
  /** A 422's messages by field (`propertyPath`), the first one of each: shown next to the field they are about. */
  readonly violations: Readonly<Record<string, string>>

  constructor(status: number, message: string, violations: Record<string, string> = {}) {
    super(message)
    this.status = status
    this.violations = violations
  }
}

// The authenticator answers {code, message}; every other error is a JSON-LD Error with `title` and `detail`.
export function errorMessage(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined
  }
  const { detail, message, title } = error as Record<string, unknown>
  return [detail, message, title].find((text): text is string => typeof text === 'string' && text !== '')
}

/** The `violations` of a ConstraintViolation (422), by field: `{email: 'This is not a valid email.'}`. */
export function violationsOf(error: unknown): Record<string, string> {
  const violations = typeof error === 'object' && error !== null ? (error as { violations?: unknown }).violations : undefined
  const result: Record<string, string> = {}
  if (Array.isArray(violations)) {
    for (const violation of violations as { propertyPath?: unknown; message?: unknown }[]) {
      if (typeof violation.propertyPath === 'string' && typeof violation.message === 'string') {
        result[violation.propertyPath] ??= violation.message
      }
    }
  }
  return result
}

/** The ApiError for a failed response and its parsed body. */
export function apiError(response: Response, error: unknown): ApiError {
  return new ApiError(response.status, errorMessage(error) ?? `Request failed (HTTP ${response.status})`, violationsOf(error))
}
