import type { Page } from '@playwright/test'
import { accountButton, expect, fillSignIn, signOut, test } from '../support/fixtures.ts'
import { EMAIL, NAME, OTHER, PASSWORD, USERNAME } from '../support/mock-api.ts'

/** A tiny PNG: the mock API takes any file, the real one reads it. */
const PICTURE = {
  name: 'me.png',
  mimeType: 'image/png',
  buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64'),
}

const field = (page: Page, label: string) => page.getByLabel(label, { exact: true })

async function openFromAccountMenu(page: Page, item: 'Profile' | 'Users') {
  await accountButton(page).click()
  await page.getByRole('menuitem', { name: item }).click()
}

/** The row of an account on the Users page. */
const row = (page: Page, name: string) => page.getByRole('list', { name: 'Accounts' }).getByRole('listitem').filter({ hasText: name })

async function chooseFor(page: Page, name: string, action: string) {
  await page.getByRole('button', { name: `More options for ${name}` }).click()
  await page.getByRole('menuitem', { name: action }).click()
}

test.describe('a new server', () => {
  test.use({ apiOptions: { noAccounts: true } })

  test('its first visitor creates the administrator, and is signed in', async ({ page, api }) => {
    await page.goto('/')
    await expect(page).toHaveURL('/setup')
    await expect(page.getByRole('heading', { name: 'Welcome to Echora' })).toBeVisible()

    await field(page, 'Email').fill('Ana.Admin@Example.com')
    await field(page, 'Name').fill('Ana Admin')
    await field(page, 'Password').fill('long enough')
    await field(page, 'Repeat the password').fill('not the same')
    await page.getByRole('button', { name: 'Create the administrator' }).click()
    await expect(page.getByText('The passwords are not the same.')).toBeVisible()
    await expect(field(page, 'Repeat the password')).toBeFocused()
    expect(api.users).toHaveLength(0)

    await field(page, 'Repeat the password').fill('long enough')
    await page.getByRole('button', { name: 'Create the administrator' }).click()

    await expect(page.getByRole('heading', { name: 'Recently added' })).toBeVisible()
    await expect(accountButton(page)).toContainText('Ana Admin')
    expect(api.users.map((user) => [user.username, user.email, user.admin])).toEqual([['ana.admin', 'ana.admin@example.com', true]])

    // Then it signs in like any account, here with its email.
    await signOut(page)
    await expect(page).toHaveURL('/login')
    await fillSignIn(page, 'ana.admin@example.com', 'long enough')
    await expect(page.getByRole('heading', { name: 'Recently added' })).toBeVisible()
  })

  test('what the API refuses is said next to the field', async ({ page, api: _api }) => {
    await page.goto('/setup')
    // Browsers take an email without a dot after the @; the API doesn't.
    await field(page, 'Email').fill('ana@localhost')
    await field(page, 'Name').fill('Ana')
    await field(page, 'Password').fill('long enough')
    await field(page, 'Repeat the password').fill('long enough')
    await page.getByRole('button', { name: 'Create the administrator' }).click()

    await expect(page.getByText('This is not a valid email.')).toBeVisible()
    await expect(field(page, 'Email')).toBeFocused()
  })

  test('when someone else was quicker, it says so and offers to sign in', async ({ page, api }) => {
    await page.goto('/setup')
    await field(page, 'Email').fill('ana@example.com')
    await field(page, 'Name').fill('Ana')
    await field(page, 'Password').fill('long enough')
    await field(page, 'Repeat the password').fill('long enough')
    api.addUser({ username: 'quick', email: 'quick@example.com', name: 'Quick', password: 'quicker!', admin: true })

    await page.getByRole('button', { name: 'Create the administrator' }).click()

    await expect(page).toHaveURL('/login')
    await expect(page.getByText('This server is already set up: sign in.')).toBeVisible()
  })
})

test('a server that is set up sends /setup to the sign-in form', async ({ page, api: _api }) => {
  await page.goto('/setup')
  await expect(page).toHaveURL('/login')
  await expect(page.getByText('This server is already set up: sign in.')).toBeVisible()
})

test('an account signs in with its email too', async ({ page, api: _api }) => {
  await page.goto('/login')
  await fillSignIn(page, EMAIL, PASSWORD)
  await expect(page.getByRole('heading', { name: 'Recently added' })).toBeVisible()
  await expect(accountButton(page)).toContainText(NAME)
})

test.describe('signed in', () => {
  test.beforeEach(async ({ signIn }) => signIn())

  test('the profile changes the name, username and email; a username taken is refused', async ({ page, api }) => {
    await openFromAccountMenu(page, 'Profile')
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()
    const save = page.getByRole('button', { name: 'Save' })
    await expect(save).toBeDisabled()

    await field(page, 'Username').fill(OTHER.username)
    await save.click()
    await expect(page.getByText('This username is already taken.')).toBeVisible()
    await expect(field(page, 'Username')).toBeFocused()

    await field(page, 'Name').fill('Lee L.')
    await field(page, 'Username').fill('lee')
    await field(page, 'Email').fill('lee@example.com')
    await save.click()

    await expect(page.getByText('Profile saved')).toBeVisible()
    await expect(accountButton(page)).toContainText('Lee L.')
    expect(api.userNamed('lee')).toMatchObject({ name: 'Lee L.', email: 'lee@example.com' })
    // Renamed, still signed in: the session names the account by its id.
    await page.reload()
    await expect(field(page, 'Username')).toHaveValue('lee')
  })

  test('a picture is added and removed, and the header shows it', async ({ page, api }) => {
    await openFromAccountMenu(page, 'Profile')

    await page.getByLabel('Add a picture').setInputFiles(PICTURE)

    await expect(page.getByRole('main').getByRole('button', { name: 'Remove picture' })).toBeVisible()
    expect(api.avatarUploads).toEqual(['me'])
    await expect(accountButton(page).locator('img')).toHaveAttribute('src', /\/api\/users\/[^/]+\/avatar\?/)

    await page.getByRole('button', { name: 'Remove picture' }).click()
    await expect(page.getByLabel('Add a picture')).toBeAttached()
    await expect(accountButton(page).locator('img')).toHaveCount(0)
    expect(api.userNamed(USERNAME).avatar).toBeNull()
  })

  test('a picture of the wrong kind is refused before it is sent', async ({ page, api }) => {
    await openFromAccountMenu(page, 'Profile')

    await page.getByLabel('Add a picture').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') })

    await expect(page.getByText('Choose a JPEG, PNG or WebP picture.')).toBeVisible()
    expect(api.avatarUploads).toEqual([])
  })

  test('the password changes with the current one; the other devices are signed out, this one is not', async ({ page, api, browser }) => {
    // Another device, signed in too.
    const other = await browser.newContext()
    await api.install(other)
    const otherPage = await other.newPage()
    await otherPage.goto('/login')
    await fillSignIn(otherPage, USERNAME, PASSWORD)
    await expect(otherPage.getByRole('heading', { name: 'Recently added' })).toBeVisible()
    expect(api.sessionsOf(USERNAME)).toBe(2)

    await openFromAccountMenu(page, 'Profile')
    await field(page, 'Current password').fill('wrong')
    await field(page, 'New password').fill('a new secret')
    await field(page, 'Repeat the new password').fill('a new secret')
    await page.getByRole('button', { name: 'Change password' }).click()
    await expect(page.getByText('The current password is wrong.')).toBeVisible()

    await field(page, 'Current password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Change password' }).click()

    await expect(page.getByText('Password changed: your other devices are signed out')).toBeVisible()
    await expect(field(page, 'Current password')).toHaveValue('')
    expect(api.sessionsOf(USERNAME)).toBe(1)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()

    await signOut(page)
    await fillSignIn(page, USERNAME, 'a new secret')
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()
    await other.close()
  })

  test('after 5 wrong current passwords, changing it is refused for a while', async ({ page }) => {
    await openFromAccountMenu(page, 'Profile')
    await field(page, 'New password').fill('a new secret')
    await field(page, 'Repeat the new password').fill('a new secret')
    for (let attempt = 1; attempt <= 5; attempt++) {
      await field(page, 'Current password').fill(`wrong ${attempt}`)
      await page.getByRole('button', { name: 'Change password' }).click()
      await expect(page.getByText('The current password is wrong.')).toBeVisible()
    }

    await field(page, 'Current password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Change password' }).click()

    await expect(page.getByRole('alert')).toHaveText('Too many wrong passwords: try again in 15 minutes.')
  })

  test('an administrator creates an account; its username comes from the email', async ({ page, api }) => {
    await openFromAccountMenu(page, 'Users')
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible()
    await expect(page.getByText('2 accounts')).toBeVisible()
    await expect(row(page, NAME)).toContainText('Admin')
    await expect(row(page, NAME)).toContainText('You')

    await page.getByRole('button', { name: 'New account' }).click()
    const dialog = page.getByRole('dialog', { name: 'New account' })
    await dialog.getByLabel('Email', { exact: true }).fill('robin@elsewhere.org')
    await dialog.getByLabel('Name', { exact: true }).fill('Robin Other')
    await dialog.getByLabel('Password', { exact: true }).fill('short')
    await dialog.getByRole('button', { name: 'Create' }).click()
    // The browser stops a password that is too short; the API would too.
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('Password', { exact: true }).fill('long enough')
    await dialog.getByRole('button', { name: 'Create' }).click()

    await expect(page.getByText('Account created: Robin Other signs in as “robin-2” or with their email')).toBeVisible()
    await expect(row(page, 'Robin Other')).toContainText('robin-2 · robin@elsewhere.org')
    expect(api.userNamed('robin-2').admin).toBe(false)
  })

  test('an email used by another account is refused in the dialog', async ({ page }) => {
    await openFromAccountMenu(page, 'Users')
    await page.getByRole('button', { name: 'New account' }).click()
    const dialog = page.getByRole('dialog', { name: 'New account' })
    await dialog.getByLabel('Email', { exact: true }).fill(OTHER.email)
    await dialog.getByLabel('Name', { exact: true }).fill('Copy')
    await dialog.getByLabel('Password', { exact: true }).fill('long enough')
    await dialog.getByRole('button', { name: 'Create' }).click()

    await expect(dialog.getByText('Another account already uses this email.')).toBeVisible()
  })

  test('an administrator edits an account, sets its password and deletes it', async ({ page, api, browser }) => {
    // Robin is signed in elsewhere.
    const other = await browser.newContext()
    await api.install(other)
    const robin = await other.newPage()
    await robin.goto('/login')
    await fillSignIn(robin, OTHER.username, OTHER.password)
    await expect(robin.getByRole('heading', { name: 'Recently added' })).toBeVisible()

    await openFromAccountMenu(page, 'Users')
    await chooseFor(page, OTHER.name, 'Edit…')
    const edit = page.getByRole('dialog', { name: `Edit ${OTHER.name}` })
    await edit.getByLabel('Name', { exact: true }).fill('Robin R.')
    await edit.getByLabel('Administrator').check()
    await edit.getByLabel('Add a picture').setInputFiles(PICTURE)
    await expect(edit.getByRole('button', { name: 'Remove picture' })).toBeVisible()
    await edit.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Robin R. saved')).toBeVisible()
    await expect(row(page, 'Robin R.')).toContainText('Admin')
    expect(api.userNamed(OTHER.username)).toMatchObject({ name: 'Robin R.', admin: true })
    expect(api.avatarUploads).toEqual([api.userNamed(OTHER.username).id])

    await chooseFor(page, 'Robin R.', 'Set password…')
    const password = page.getByRole('dialog', { name: 'Set a password for Robin R.' })
    await password.getByLabel('New password').fill('robin again')
    await password.getByRole('button', { name: 'Set password' }).click()
    await expect(page.getByText('Password changed: Robin R. is signed out of every device')).toBeVisible()
    expect(api.sessionsOf(OTHER.username)).toBe(0)

    await chooseFor(page, 'Robin R.', 'Delete…')
    await page.getByRole('dialog', { name: 'Delete Robin R.\'s account?' }).getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('Robin R.\'s account deleted')).toBeVisible()
    await expect(row(page, 'Robin R.')).toHaveCount(0)
    expect(api.users.map((user) => user.username)).toEqual([USERNAME])
    await other.close()
  })

  test('their own account: no Delete, the password on the profile, and the last administrator stays one', async ({ page }) => {
    await openFromAccountMenu(page, 'Users')

    await page.getByRole('button', { name: `More options for ${NAME}` }).click()
    await expect(page.getByRole('menuitem', { name: 'Delete…' })).toHaveCount(0)
    await page.getByRole('menuitem', { name: 'Change password' }).click()
    await expect(page).toHaveURL('/profile')

    await openFromAccountMenu(page, 'Users')
    await chooseFor(page, NAME, 'Edit…')
    const edit = page.getByRole('dialog', { name: `Edit ${NAME}` })
    await edit.getByLabel('Administrator').uncheck()
    await expect(edit.getByText('You will no longer manage this server, nor see this page.')).toBeVisible()
    await edit.getByRole('button', { name: 'Save' }).click()

    await expect(edit.getByRole('alert')).toHaveText('This is the last administrator: make another account an administrator first.')
  })

  test('an administrator who stops being one leaves the page, and the menu no longer offers it', async ({ page, api }) => {
    api.userNamed(OTHER.username).admin = true
    await openFromAccountMenu(page, 'Users')
    await chooseFor(page, NAME, 'Edit…')
    const edit = page.getByRole('dialog', { name: `Edit ${NAME}` })
    await edit.getByLabel('Administrator').uncheck()
    await edit.getByRole('button', { name: 'Save' }).click()

    await expect(page).toHaveURL('/')
    await expect(page.getByText('You no longer manage this server')).toBeVisible()
    await accountButton(page).click()
    await expect(page.getByRole('menuitem', { name: 'Users' })).toHaveCount(0)
  })
})

test('an account that is not an administrator has no Users page', async ({ page, api: _api }) => {
  await page.goto('/login')
  await fillSignIn(page, OTHER.username, OTHER.password)
  await expect(page.getByRole('heading', { name: 'Recently added' })).toBeVisible()

  await accountButton(page).click()
  await expect(page.getByRole('menuitem', { name: 'Profile' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Users' })).toHaveCount(0)

  await page.goto('/admin/users')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
})
