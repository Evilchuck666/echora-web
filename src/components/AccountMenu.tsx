import { useNavigate } from 'react-router'
import { displayName, useCurrentUser } from '../account/accounts'
import { signOut } from '../auth/session'
import { ActionsMenu, type MenuAction } from './ActionsMenu'
import { Avatar } from './Avatar'

/** The header's account button (picture and name): the profile, the accounts (administrators) and signing out. */
export function AccountMenu() {
  const { data: user } = useCurrentUser()
  const navigate = useNavigate()
  const name = user ? displayName(user) : ''

  const actions: MenuAction[] = [
    { label: 'Profile', onSelect: () => navigate('/profile') },
    ...(user?.admin ? [{ label: 'Users', description: 'Accounts of this server', onSelect: () => navigate('/admin/users') }] : []),
    { label: 'Sign out', onSelect: () => signOut() },
  ]

  return (
    <ActionsMenu
      label={user ? `Account: ${name}` : 'Account'}
      actions={actions}
      buttonClassName="flex items-center gap-2 rounded-full p-1 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white aria-expanded:bg-neutral-800 sm:pr-3"
      icon={
        <>
          {user ? <Avatar account={user} className="w-8 text-sm" /> : <span className="block h-8 w-8 rounded-full bg-neutral-800" />}
          <span className="hidden max-w-40 truncate sm:inline">{name}</span>
        </>
      }
    />
  )
}
