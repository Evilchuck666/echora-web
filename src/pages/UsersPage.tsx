import { useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import {
  createUser,
  deleteUser,
  displayName,
  MAX_NAME,
  MIN_PASSWORD,
  updateUser,
  useCurrentUser,
  USERNAME_PATTERN,
  useUsers,
  type Account,
} from '../account/accounts'
import { ActionsMenu, type MenuAction } from '../components/ActionsMenu'
import { Avatar } from '../components/Avatar'
import { AvatarPicker } from '../components/AvatarPicker'
import { Dialog } from '../components/Dialog'
import { focusFirstInvalid, formErrors, NO_ERRORS, type FormErrors } from '../components/form-errors'
import { Field, FormError, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../components/forms'
import { InfiniteScrollTrigger } from '../components/InfiniteScrollTrigger'
import { QueryError } from '../components/QueryError'
import { Spinner } from '../components/Spinner'
import { showToast } from '../components/toast'
import { plural } from '../library/format'
import { NotFoundPage } from './NotFoundPage'

const OFFLINE = "Couldn't reach the server. Try again."

type Editing = { kind: 'new' } | { kind: 'edit' | 'password' | 'delete'; account: Account }

/**
 * The accounts of the server, for administrators: create, change, set a password, delete. There is no sign-up: every
 * account but the first is made here. The API keeps an administrator, and an administrator's own account can't be
 * deleted; their own password is changed from the profile, which keeps them signed in.
 */
export function UsersPage() {
  const me = useCurrentUser()
  const users = useUsers()
  const [editing, setEditing] = useState<Editing | null>(null)
  const close = () => setEditing(null)

  if (me.isPending) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }
  if (!me.data?.admin) {
    return <NotFoundPage />
  }

  const members = users.data?.pages.flatMap((page) => page.member) ?? []
  const total = users.data?.pages[0]?.totalItems

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Users</h1>
          {total !== undefined && <p className="mt-1 text-sm text-neutral-400">{plural(total, 'account')}</p>}
        </div>
        <button type="button" onClick={() => setEditing({ kind: 'new' })} className={PRIMARY_BUTTON}>
          New account
        </button>
      </div>

      {users.isPending ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : users.isLoadingError ? (
        <QueryError error={users.error} retry={users.refetch} />
      ) : (
        <>
          <ul aria-label="Accounts" className="mt-6 divide-y divide-neutral-800">
            {members.map((account) => (
              <AccountRow key={account.id} account={account} self={account.id === me.data.id} onEdit={setEditing} />
            ))}
          </ul>
          <InfiniteScrollTrigger {...users} />
        </>
      )}

      {editing?.kind === 'new' && <NewAccountDialog onClose={close} />}
      {editing?.kind === 'edit' && <EditAccountDialog account={editing.account} self={editing.account.id === me.data.id} onClose={close} />}
      {editing?.kind === 'password' && <PasswordDialog account={editing.account} onClose={close} />}
      {editing?.kind === 'delete' && <DeleteAccountDialog account={editing.account} onClose={close} />}
    </main>
  )
}

function AccountRow({ account, self, onEdit }: { account: Account; self: boolean; onEdit: (editing: Editing) => void }) {
  const navigate = useNavigate()
  const name = displayName(account)
  const actions: MenuAction[] = [
    { label: 'Edit…', onSelect: () => onEdit({ kind: 'edit', account }) },
    self
      ? { label: 'Change password', description: 'On your profile', onSelect: () => navigate('/profile') }
      : { label: 'Set password…', onSelect: () => onEdit({ kind: 'password', account }) },
    ...(self ? [] : [{ label: 'Delete…', onSelect: () => onEdit({ kind: 'delete', account }) }]),
  ]

  return (
    <li className="flex items-center gap-3 py-3">
      <Avatar account={account} className="w-10 shrink-0 text-base" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{name}</span>
          {account.admin && <Badge>Admin</Badge>}
          {self && <Badge>You</Badge>}
        </p>
        <p className="truncate text-sm text-neutral-400">
          {account.username} · {account.email ?? 'No email'}
        </p>
      </div>
      <ActionsMenu label={`More options for ${name}`} actions={actions} />
    </li>
  )
}

function Badge({ children }: { children: string }) {
  return <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300">{children}</span>
}

function AdminCheckbox({ checked, onChange, note }: { checked: boolean; onChange: (checked: boolean) => void; note?: string }) {
  return (
    <label className="flex items-start gap-3 text-sm text-neutral-200">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 h-4 w-4 accent-violet-500" />
      <span>
        Administrator
        <span className="block text-xs text-neutral-500">{note ?? 'Manages this server and its accounts.'}</span>
      </span>
    </label>
  )
}

function DialogButtons({ onClose, submitLabel, busy, danger = false }: { onClose: () => void; submitLabel: string; busy: boolean; danger?: boolean }) {
  return (
    <div className="mt-2 flex justify-end gap-2">
      <button type="button" onClick={onClose} className={SECONDARY_BUTTON}>
        Cancel
      </button>
      <button
        type="submit"
        disabled={busy}
        className={danger ? 'rounded-md bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-500 disabled:opacity-60' : PRIMARY_BUTTON}
      >
        {submitLabel}
      </button>
    </div>
  )
}

/** A dialog's form: sends, and sorts what the API refused next to the fields (or above the buttons). */
function useDialogForm(fields: string[]) {
  const form = useRef<HTMLFormElement>(null)
  const [errors, setErrors] = useState<FormErrors>(NO_ERRORS)
  const [busy, setBusy] = useState(false)

  async function send(run: () => Promise<void>) {
    setBusy(true)
    setErrors(NO_ERRORS)
    try {
      await run()
    } catch (error) {
      setErrors(formErrors(error, fields, OFFLINE))
      setBusy(false)
      focusFirstInvalid(form.current)
    }
  }

  return { form, errors, setErrors, busy, send }
}

function NewAccountDialog({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [admin, setAdmin] = useState(false)
  const { form, errors, busy, send } = useDialogForm(['email', 'name', 'password'])

  function submit(event: FormEvent) {
    event.preventDefault()
    void send(async () => {
      const account = await createUser({ email: email.trim(), name: name.trim(), password, admin })
      onClose()
      showToast(`Account created: ${displayName(account)} signs in as “${account.username}” or with their email`)
    })
  }

  return (
    <Dialog title="New account" onClose={onClose}>
      <form ref={form} onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required error={errors.fields.email} hint="Their username is made from it." />
        <Field label="Name" value={name} onChange={(event) => setName(event.target.value)} maxLength={MAX_NAME} required error={errors.fields.name} />
        <Field
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={MIN_PASSWORD}
          required
          error={errors.fields.password}
          hint={`At least ${MIN_PASSWORD} characters. They can change it from their profile.`}
        />
        <AdminCheckbox checked={admin} onChange={setAdmin} />
        <FormError message={errors.form} />
        <DialogButtons onClose={onClose} submitLabel={busy ? 'Creating…' : 'Create'} busy={busy} />
      </form>
    </Dialog>
  )
}

function EditAccountDialog({ account, self, onClose }: { account: Account; self: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const [name, setName] = useState(account.name ?? '')
  const [username, setUsername] = useState(account.username ?? '')
  const [email, setEmail] = useState(account.email ?? '')
  const [admin, setAdmin] = useState(Boolean(account.admin))
  const { form, errors, busy, send } = useDialogForm(['name', 'username', 'email'])
  const title = displayName(account)

  // Only what changed is sent. An email can be set, not removed.
  const patch = {
    ...(name.trim() !== account.name ? { name: name.trim() } : {}),
    ...(username.trim() !== account.username ? { username: username.trim() } : {}),
    ...(email.trim() && email.trim() !== account.email ? { email: email.trim() } : {}),
    ...(admin !== Boolean(account.admin) ? { admin } : {}),
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (Object.keys(patch).length === 0) {
      onClose()
      return
    }
    void send(async () => {
      const saved = await updateUser(account.id!, patch)
      onClose()
      if (self && !saved.admin) {
        // This page is for administrators only.
        void navigate('/', { replace: true })
        showToast('You no longer manage this server')
      } else {
        showToast(`${displayName(saved)} saved`)
      }
    })
  }

  return (
    <Dialog title={`Edit ${title}`} onClose={onClose}>
      <form ref={form} onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Name" value={name} onChange={(event) => setName(event.target.value)} maxLength={MAX_NAME} required error={errors.fields.name} />
        <Field
          label="Username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          pattern={USERNAME_PATTERN}
          title="3 to 32 letters, digits, dots, dashes or underscores"
          required
          error={errors.fields.username}
        />
        <Field label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required={Boolean(account.email)} error={errors.fields.email} />
        <AdminCheckbox
          checked={admin}
          onChange={setAdmin}
          note={self && account.admin && !admin ? 'You will no longer manage this server, nor see this page.' : undefined}
        />
        <div className="flex flex-col gap-2 text-sm text-neutral-300">
          Picture
          <AvatarPicker account={account} userId={account.id} />
        </div>
        <FormError message={errors.form} />
        <DialogButtons onClose={onClose} submitLabel={busy ? 'Saving…' : 'Save'} busy={busy} />
      </form>
    </Dialog>
  )
}

function PasswordDialog({ account, onClose }: { account: Account; onClose: () => void }) {
  const [password, setPassword] = useState('')
  const { form, errors, busy, send } = useDialogForm(['password'])
  const name = displayName(account)

  function submit(event: FormEvent) {
    event.preventDefault()
    void send(async () => {
      await updateUser(account.id!, { password })
      onClose()
      showToast(`Password changed: ${name} is signed out of every device`)
    })
  }

  return (
    <Dialog title={`Set a password for ${name}`} onClose={onClose}>
      <form ref={form} onSubmit={submit} className="flex flex-col gap-4">
        <input type="text" autoComplete="username" value={account.username ?? ''} hidden readOnly />
        <Field
          label="New password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={MIN_PASSWORD}
          required
          error={errors.fields.password}
          hint={`At least ${MIN_PASSWORD} characters. ${name} is signed out of every device.`}
        />
        <FormError message={errors.form} />
        <DialogButtons onClose={onClose} submitLabel={busy ? 'Saving…' : 'Set password'} busy={busy} />
      </form>
    </Dialog>
  )
}

function DeleteAccountDialog({ account, onClose }: { account: Account; onClose: () => void }) {
  const { form, errors, busy, send } = useDialogForm([])
  const name = displayName(account)

  function submit(event: FormEvent) {
    event.preventDefault()
    void send(async () => {
      await deleteUser(account.id!)
      onClose()
      showToast(`${name}'s account deleted`)
    })
  }

  return (
    <Dialog title={`Delete ${name}'s account?`} onClose={onClose}>
      <form ref={form} onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-neutral-300">Their playlists, favourites and picture are deleted too, and they are signed out at once. The music stays.</p>
        <FormError message={errors.form} />
        <DialogButtons onClose={onClose} submitLabel="Delete" busy={busy} danger />
      </form>
    </Dialog>
  )
}
