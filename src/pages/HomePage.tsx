import { useCurrentUser } from '../auth/useCurrentUser'

export function HomePage() {
  const { data: user } = useCurrentUser()

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 p-4">
      <h1 className="text-3xl font-semibold tracking-tight">{user ? `Welcome, ${user.username}` : 'Welcome'}</h1>
      <p className="text-neutral-400">Your library will appear here.</p>
    </main>
  )
}
