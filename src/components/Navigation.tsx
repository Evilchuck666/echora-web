import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import { ArtistsIcon, HeartIcon } from '../player/icons'

interface NavItemProps {
  to: string
  icon: ReactNode
  children: ReactNode
  /** Only active on this exact path (the home page). */
  end?: boolean
}

function NavItem({ to, icon, children, end }: NavItemProps) {
  return (
    <li>
      <NavLink
        to={to}
        end={end}
        className="flex items-center gap-3 rounded-md px-3 py-2 text-neutral-300 hover:bg-neutral-900 hover:text-white aria-[current=page]:bg-neutral-900 aria-[current=page]:text-white"
      >
        <span className="text-neutral-400">{icon}</span>
        {children}
      </NavLink>
    </li>
  )
}

/** The places of the app: the sidebar of large screens and the drawer of small ones both show it. */
export function Navigation() {
  return (
    <nav aria-label="Library">
      <ul className="flex flex-col gap-1">
        <NavItem to="/" end icon={<ArtistsIcon />}>
          Artists
        </NavItem>
        <NavItem to="/favourites" icon={<HeartIcon />}>
          Favourites
        </NavItem>
      </ul>
    </nav>
  )
}
