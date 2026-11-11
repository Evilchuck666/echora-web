import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { MAX_NAME, MIN_PASSWORD, updateProfile, useCurrentUser, USERNAME_PATTERN, type Account } from '../account/accounts'
import { changePassword } from '../auth/session'
import { AvatarPicker } from '../components/AvatarPicker'
import { focusFirstInvalid, formErrors, NO_ERRORS, type FormErrors } from '../components/form-errors'
import { Field, FormError, PRIMARY_BUTTON } from '../components/forms'
import { QueryError } from '../components/QueryError'
import { Spinner } from '../components/Spinner'
import { showToast } from '../components/toast'

const OFFLINE = "Couldn't reach the server. Try again."

/** The account signed in: its picture, name, username and email, and its password. */
export function ProfilePage() {
  const me = useCurrentUser()

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
      {me.isPending ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : me.isLoadingError ? (
        <QueryError error={me.error} retry={me.refetch} />
      ) : (
        <>
          <Section title="Picture">
            <AvatarPicker account={me.data} />
          </Section>
          <Section title="Details">
            {/* Keyed by what the API last said, so the fields start from it again after a save. */}
            <DetailsForm key={`${me.data.name}|${me.data.username}|${me.data.email}`} account={me.data} />
          </Section>
          <Section title="Password">
            <PasswordForm username={me.data.username ?? ''} />
          </Section>
        </>
      )}
    </main>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="mt-8 border-t border-neutral-800 pt-6">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function DetailsForm({ account }: { account: Account }) {
  const form = useRef<HTMLFormElement>(null)
  const [name, setName] = useState(account.name ?? '')
  const [username, setUsername] = useState(account.username ?? '')
  const [email, setEmail] = useState(account.email ?? '')
  const [errors, setErrors] = useState<FormErrors>(NO_ERRORS)
  const [saving, setSaving] = useState(false)

  // Only what changed is sent. An email can be set, not removed (older accounts have none until one is set).
  const patch = {
    ...(name.trim() !== account.name ? { name: name.trim() } : {}),
    ...(username.trim() !== account.username ? { username: username.trim() } : {}),
    ...(email.trim() && email.trim() !== account.email ? { email: email.trim() } : {}),
  }
  const changed = Object.keys(patch).length > 0

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setErrors(NO_ERRORS)
    try {
      await updateProfile(patch)
      showToast('Profile saved')
    } catch (error) {
      setErrors(formErrors(error, ['name', 'username', 'email'], OFFLINE))
      setSaving(false)
      focusFirstInvalid(form.current)
    }
  }

  return (
    <form ref={form} onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
      <Field
        label="Name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        autoComplete="name"
        maxLength={MAX_NAME}
        required
        error={errors.fields.name}
        hint="Shown to the others."
      />
      <Field
        label="Username"
        value={username}
        onChange={(event) => setUsername(event.target.value)}
        autoComplete="username"
        pattern={USERNAME_PATTERN}
        title="3 to 32 letters, digits, dots, dashes or underscores"
        required
        error={errors.fields.username}
        hint="You sign in with it or with your email. 3 to 32 letters, digits, dots, dashes or underscores."
      />
      <Field
        label="Email"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        autoComplete="email"
        required={Boolean(account.email)}
        error={errors.fields.email}
      />
      <FormError message={errors.form} />
      <div>
        <button type="submit" disabled={!changed || saving} className={PRIMARY_BUTTON}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}

function PasswordForm({ username }: { username: string }) {
  const form = useRef<HTMLFormElement>(null)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [errors, setErrors] = useState<FormErrors>(NO_ERRORS)
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (next !== repeat) {
      setErrors({ fields: { repeat: 'The passwords are not the same.' }, form: null })
      focusFirstInvalid(form.current)
      return
    }
    setSaving(true)
    setErrors(NO_ERRORS)
    try {
      await changePassword(current, next)
      setCurrent('')
      setNext('')
      setRepeat('')
      showToast('Password changed: your other devices are signed out')
    } catch (error) {
      // The API names the new password `newPassword`.
      const { fields, form: message } = formErrors(error, ['currentPassword', 'newPassword'], OFFLINE)
      const renamed = Object.entries(fields).map(([field, text]) => [field === 'currentPassword' ? 'current' : 'next', text])
      setErrors({ fields: Object.fromEntries(renamed), form: message })
      focusFirstInvalid(form.current)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form ref={form} onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
      {/* For password managers: whose password this is. */}
      <input type="text" autoComplete="username" value={username} hidden readOnly />
      <Field
        label="Current password"
        type="password"
        value={current}
        onChange={(event) => setCurrent(event.target.value)}
        autoComplete="current-password"
        required
        error={errors.fields.current}
      />
      <Field
        label="New password"
        type="password"
        value={next}
        onChange={(event) => setNext(event.target.value)}
        autoComplete="new-password"
        minLength={MIN_PASSWORD}
        required
        error={errors.fields.next}
        hint={`At least ${MIN_PASSWORD} characters. Your other devices are signed out.`}
      />
      <Field
        label="Repeat the new password"
        type="password"
        value={repeat}
        onChange={(event) => setRepeat(event.target.value)}
        autoComplete="new-password"
        required
        error={errors.fields.repeat}
      />
      <FormError message={errors.form} />
      <div>
        <button type="submit" disabled={saving} className={PRIMARY_BUTTON}>
          {saving ? 'Changing…' : 'Change password'}
        </button>
      </div>
    </form>
  )
}
