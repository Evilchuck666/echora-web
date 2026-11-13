import type { ReactNode } from 'react'
import { NavLink } from 'react-router'

/** A row of tabs that are links (each one a URL), the current one filled. */
export function Tabs({ label, children }: { label: string; children: ReactNode }) {
  return (
    <nav aria-label={label} className="mt-4 mb-6 flex flex-wrap gap-2">
      {children}
    </nav>
  )
}

export function Tab({ to, children }: { to: string; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      end
      className="rounded-full border border-neutral-700 px-4 py-1.5 text-sm text-neutral-300 hover:border-neutral-500 hover:text-white aria-[current=page]:border-neutral-100 aria-[current=page]:bg-neutral-100 aria-[current=page]:text-neutral-950"
    >
      {children}
    </NavLink>
  )
}
