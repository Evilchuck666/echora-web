import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router'
import { MAX_NAME, MIN_PASSWORD } from '../account/accounts'
import { ApiError } from '../api/client'
import { setupRequired, setUpServer } from '../auth/session'
import { useSession } from '../auth/tokens'
import { formErrors, NO_ERRORS, useFocusOnErrors, type FormErrors } from '../components/form-errors'
import { Field, FormError, PRIMARY_BUTTON } from '../components/forms'
import { Spinner } from '../components/Spinner'
import type { LoginState } from './LoginPage'

const ALREADY_SET_UP = 'This server is already set up: sign in.'

/**
 * A new server's first page (like Immich's): whoever opens it first creates the administrator, who then manages the
 * other accounts. Once the server has an account, this sends to the sign-in page.
 */
export function SetupPage() {
  const signedIn = useSession((session) => session.signedIn)
  const queryClient = useQueryClient()
  const form = useRef<HTMLFormElement>(null)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [errors, setErrors] = useState<FormErrors>(NO_ERRORS)
  useFocusOnErrors(form, errors)
  const [saving, setSaving] = useState(false)
  const setup = useQuery({ queryKey: ['setup'], queryFn: setupRequired, enabled: !signedIn, gcTime: 0, retry: false })

  if (signedIn) {
    return <Navigate to="/" replace />
  }
  if (setup.isPending) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <Spinner />
      </main>
    )
  }
  if (!setup.data) {
    return <Navigate to="/login" replace state={{ notice: ALREADY_SET_UP } satisfies LoginState} />
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (password !== repeat) {
      setErrors({ fields: { repeat: 'The passwords are not the same.' }, form: null })
      return
    }
    setSaving(true)
    setErrors(NO_ERRORS)
    try {
      // Signed in once it is done: the redirect above takes over.
      await setUpServer({ email: email.trim(), name: name.trim(), password })
    } catch (error) {
      setSaving(false)
      if (error instanceof ApiError && error.status === 409) {
        // Someone else was quicker: the redirect above takes over (the sign-in page reads the same answer).
        queryClient.setQueryData(['setup'], false)
        return
      }
      setErrors(formErrors(error, ['email', 'name', 'password'], "Couldn't reach the server. Is the Echora API running?"))
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <form ref={form} onSubmit={(event) => void submit(event)} className="flex w-full max-w-sm flex-col gap-4">
        <div className="mb-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Welcome to Echora</h1>
          <p className="mt-2 text-sm text-neutral-400">
            Create the administrator account. It manages this server and creates the accounts of the people who listen to it.
          </p>
        </div>

        <Field
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          autoFocus
          required
          error={errors.fields.email}
          hint="You sign in with it, or with the username made from it."
        />
        <Field
          label="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="name"
          maxLength={MAX_NAME}
          required
          error={errors.fields.name}
          hint="Shown to the others."
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          minLength={MIN_PASSWORD}
          required
          error={errors.fields.password}
          hint={`At least ${MIN_PASSWORD} characters.`}
        />
        <Field
          label="Repeat the password"
          type="password"
          value={repeat}
          onChange={(event) => setRepeat(event.target.value)}
          autoComplete="new-password"
          required
          error={errors.fields.repeat}
        />

        <FormError message={errors.form} />

        <button type="submit" disabled={saving} className={PRIMARY_BUTTON}>
          {saving ? 'Creating…' : 'Create the administrator'}
        </button>
      </form>
    </main>
  )
}
