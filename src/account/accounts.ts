import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { api, unwrap, unwrapEmpty } from '../api/client'
import type { components } from '../api/schema'
import { queryClient } from '../app/query-client'
import { nextPage } from '../library/queries'

// Accounts, as the API manages them (like Immich): the first one, created when the server is set up, is an
// administrator; administrators create, change and delete the others (/api/users); everyone changes their own name,
// username, email, password and picture (/api/me). Sessions name accounts by id, so a rename keeps them.

export type Account = components['schemas']['User.jsonld-user.read']
type AccountPatch = components['schemas']['User-user.self_user.admin.jsonMergePatch']
type ProfilePatch = components['schemas']['User-user.self.jsonMergePatch']

const MERGE_PATCH = { headers: { 'Content-Type': 'application/merge-patch+json' } }

/** What the API accepts as a picture: it crops it to a square and keeps a JPEG of up to 300×300. */
export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024

/** The longest name the API accepts. */
export const MAX_NAME = 100
/** Usernames: 3 to 32 letters, digits, dots, dashes or underscores. */
export const USERNAME_PATTERN = '[A-Za-z0-9._\\-]{3,32}'
/** The shortest password the API accepts. */
export const MIN_PASSWORD = 8

const ME = ['me']
const USERS = ['users']

/** The account this browser is signed in as. */
export function useCurrentUser() {
  return useQuery({
    queryKey: ME,
    queryFn: () => unwrap(api.GET('/api/me')),
  })
}

/** The name to show for an account: its name, or its username for an account that somehow has none. */
export function displayName(account: Pick<Account, 'name' | 'username'>): string {
  return account.name || account.username || 'Unknown'
}

/** Changes the name, username or email of the account signed in. Throws an ApiError (422 with the fields refused). */
export async function updateProfile(patch: ProfilePatch): Promise<Account> {
  const account = await unwrap(api.PATCH('/api/me', { body: patch, ...MERGE_PATCH }))
  learn(account)
  return account
}

/**
 * Sets the picture of an account: the one signed in, or any (`id`, administrators). A JPEG, PNG or WebP picture of
 * up to 5 MB, checked here first so a wrong file needn't be sent; the API checks again, from the content.
 */
export async function uploadAvatar(file: File, id?: string): Promise<Account> {
  if (!AVATAR_TYPES.includes(file.type)) {
    throw new Error('Choose a JPEG, PNG or WebP picture.')
  }
  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error('The picture is too large: 5 MB at most.')
  }
  const form = new FormData()
  form.append('file', file)
  // openapi-fetch sends a FormData as it is (multipart, with its boundary). The API answers with plain JSON.
  const body = form as unknown as { file: string }
  const account = (await unwrap(
    id ? api.POST('/api/users/{id}/avatar', { params: { path: { id } }, body }) : api.POST('/api/me/avatar', { body }),
  )) as unknown as Account
  learn(account)
  return account
}

/** Removes the picture of an account: the one signed in, or any (`id`, administrators). */
export async function removeAvatar(id?: string): Promise<void> {
  await unwrapEmpty(id ? api.DELETE('/api/users/{id}/avatar', { params: { path: { id } } }) : api.DELETE('/api/me/avatar'))
  const me = queryClient.getQueryData<Account>(ME)
  if (me && (!id || id === me.id)) {
    queryClient.setQueryData<Account>(ME, { ...me, avatarUrl: null })
  }
  void queryClient.invalidateQueries({ queryKey: USERS })
}

/** Every account, by username (administrators only). */
export function useUsers() {
  return useInfiniteQuery({
    queryKey: USERS,
    queryFn: ({ pageParam }) => unwrap(api.GET('/api/users', { params: { query: { page: pageParam } } })),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => nextPage(lastPage.view),
  })
}

export interface NewAccount {
  email: string
  name: string
  password: string
  admin: boolean
}

/** Creates an account (administrators). Its username is made from the email. Throws an ApiError (422 by field). */
export async function createUser(details: NewAccount): Promise<Account> {
  const account = await unwrap(api.POST('/api/users', { body: details }))
  void queryClient.invalidateQueries({ queryKey: USERS })
  return account
}

/**
 * Changes an account (administrators): name, username, email, administrator or not, password (which signs it out of
 * every device). Throws an ApiError: 422 by field, 409 when it would leave the server without an administrator.
 */
export async function updateUser(id: string, patch: AccountPatch): Promise<Account> {
  const account = await unwrap(api.PATCH('/api/users/{id}', { params: { path: { id } }, body: patch, ...MERGE_PATCH }))
  learn(account)
  return account
}

/** Deletes an account, with its playlists, favourites and picture (administrators; never their own: 409). */
export async function deleteUser(id: string): Promise<void> {
  await unwrapEmpty(api.DELETE('/api/users/{id}', { params: { path: { id } } }))
  void queryClient.invalidateQueries({ queryKey: USERS })
}

/** An account as the API returned it after a change: the one signed in follows at once, the list is read again. */
function learn(account: Account): void {
  const me = queryClient.getQueryData<Account>(ME)
  if (me && account.id === me.id) {
    queryClient.setQueryData<Account>(ME, { ...me, ...account })
  }
  void queryClient.invalidateQueries({ queryKey: USERS })
}
