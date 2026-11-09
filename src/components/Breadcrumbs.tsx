import { Fragment } from 'react'
import { Link } from 'react-router'

export interface Crumb {
  label: string
  /** Omitted for the current page, the last crumb. */
  to?: string
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-neutral-400">
      {/* A crumb whose label isn't loaded yet is left out, instead of leaving a dangling separator. */}
      {items.filter((item) => item.label).map((item, index) => (
        <Fragment key={index}>
          {index > 0 && <span aria-hidden="true">›</span>}
          {item.to ? (
            <Link to={item.to} className="hover:text-neutral-100">
              {item.label}
            </Link>
          ) : (
            <span aria-current="page" className="truncate text-neutral-200">
              {item.label}
            </span>
          )}
        </Fragment>
      ))}
    </nav>
  )
}
