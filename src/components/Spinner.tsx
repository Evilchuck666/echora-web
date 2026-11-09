export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 text-sm text-neutral-400">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-600 border-t-violet-400" />
      {label}…
    </div>
  )
}
