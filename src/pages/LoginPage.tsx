import { useMutation, useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, type Location } from 'react-router'
import { InvalidCredentialsError, setupRequired, signIn, TooManyAttemptsError } from '../auth/session'
import { useSession } from '../auth/tokens'
import { Field, PRIMARY_BUTTON } from '../components/forms'
import { Spinner } from '../components/Spinner'

/** What other pages pass to /login: where to go back to, and a word to show (e.g. from /setup). */
export interface LoginState {
  from?: Location
  notice?: string
}

export function LoginPage() {
  const signedIn = useSession((session) => session.signedIn)
  const location = useLocation()
  const state = location.state as LoginState | null
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const login = useMutation({ mutationFn: () => signIn(username, password) })
  // A new server has no account to sign in with: its first visitor creates the administrator instead. Asked on every
  // visit (no cache), and never retried: an unreachable server shows the form, which says so when used.
  const setup = useQuery({ queryKey: ['setup'], queryFn: setupRequired, enabled: !signedIn, gcTime: 0, retry: false })

  if (signedIn) {
    // Back to the page that asked for a sign-in, or home. Also covers signing in from another tab.
    return <Navigate to={state?.from ?? '/'} replace />
  }
  if (setup.data === true) {
    return <Navigate to="/setup" replace />
  }
  if (setup.isPending) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <Spinner />
      </main>
    )
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    login.mutate()
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="mb-2 text-center text-3xl font-semibold tracking-tight">Echora</h1>

        {state?.notice && <p className="rounded-md bg-neutral-800 px-3 py-2 text-sm text-neutral-200">{state.notice}</p>}

        <Field
          label="Email or username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
          autoFocus
          required
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />

        {login.error && (
          <p role="alert" className="text-sm text-red-400">
            {login.error instanceof InvalidCredentialsError || login.error instanceof TooManyAttemptsError
              ? login.error.message
              : "Couldn't reach the server. Is the Echora API running?"}
          </p>
        )}

        <button type="submit" disabled={login.isPending} className={PRIMARY_BUTTON}>
          {login.isPending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}
