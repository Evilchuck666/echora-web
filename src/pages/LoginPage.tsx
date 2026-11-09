import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, type Location } from 'react-router'
import { InvalidCredentialsError, signIn } from '../auth/session'
import { useSession } from '../auth/tokens'

export function LoginPage() {
  const signedIn = useSession((session) => session.signedIn)
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const login = useMutation({ mutationFn: () => signIn(username, password) })

  if (signedIn) {
    // Back to the page that asked for a sign-in, or home. Also covers signing in from another tab.
    const from = (location.state as { from?: Location } | null)?.from
    return <Navigate to={from ?? '/'} replace />
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    login.mutate()
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="mb-2 text-center text-3xl font-semibold tracking-tight">Echora</h1>

        <label className="flex flex-col gap-1 text-sm text-neutral-300">
          Username
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            autoFocus
            required
            className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-base text-neutral-100 outline-none focus:border-violet-500"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-neutral-300">
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
            className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-base text-neutral-100 outline-none focus:border-violet-500"
          />
        </label>

        {login.error && (
          <p role="alert" className="text-sm text-red-400">
            {login.error instanceof InvalidCredentialsError
              ? login.error.message
              : "Couldn't reach the server. Is the Echora API running?"}
          </p>
        )}

        <button
          type="submit"
          disabled={login.isPending}
          className="rounded-md bg-violet-600 px-3 py-2 font-medium text-white hover:bg-violet-500 disabled:opacity-60"
        >
          {login.isPending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}
