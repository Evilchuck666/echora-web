import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link to="/" className="text-violet-400 hover:underline">
        Back to the library
      </Link>
    </main>
  )
}
