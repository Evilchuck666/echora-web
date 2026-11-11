import { useState, type ChangeEvent } from 'react'
import { AVATAR_TYPES, removeAvatar, uploadAvatar, type Account } from '../account/accounts'
import { Avatar } from './Avatar'
import { formErrors } from './form-errors'

interface AvatarPickerProps {
  account: Account
  /** Whose picture: the account signed in unless set (an administrator changing someone's). */
  userId?: string
}

/**
 * An account's picture, with "Change picture" (a JPEG, PNG or WebP file of up to 5 MB, which the API crops to a
 * square) and "Remove picture".
 */
export function AvatarPicker({ account, userId }: AvatarPickerProps) {
  // What the API last answered here, ahead of `account` (an administrator's list is read again afterwards).
  const [avatarUrl, setAvatarUrl] = useState<string | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const shown = { ...account, avatarUrl: avatarUrl === undefined ? account.avatarUrl : avatarUrl }

  async function change(run: () => Promise<string | null>) {
    setBusy(true)
    setError(null)
    try {
      setAvatarUrl(await run())
    } catch (caught) {
      setError(formErrors(caught, [], "Couldn't change the picture. Try again.").form)
    } finally {
      setBusy(false)
    }
  }

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Cleared, so choosing the same file again (after an error) still counts as a change.
    event.target.value = ''
    if (file) {
      void change(async () => (await uploadAvatar(file, userId)).avatarUrl ?? null)
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar account={shown} className="w-20 shrink-0 text-3xl" />
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <label
            className={`cursor-pointer rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 focus-within:border-violet-500 hover:border-neutral-500 hover:text-white ${busy ? 'pointer-events-none opacity-60' : ''}`}
          >
            {shown.avatarUrl ? 'Change picture' : 'Add a picture'}
            <input type="file" accept={AVATAR_TYPES.join(',')} onChange={onFile} disabled={busy} className="sr-only" />
          </label>
          {shown.avatarUrl && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void change(async () => {
                  await removeAvatar(userId)
                  return null
                })
              }
              className="rounded-md px-3 py-1.5 text-sm text-neutral-400 hover:text-white disabled:opacity-60"
            >
              Remove picture
            </button>
          )}
        </div>
        {error ? (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        ) : (
          <p className="text-xs text-neutral-500">JPEG, PNG or WebP, up to 5 MB. It is cropped to a square.</p>
        )}
      </div>
    </div>
  )
}
