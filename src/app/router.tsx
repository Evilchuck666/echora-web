import { createBrowserRouter, Navigate } from 'react-router'
import { RequireAuth } from '../auth/RequireAuth'
import { AppLayout } from '../components/AppLayout'
import { Spinner } from '../components/Spinner'
import { AlbumPage } from '../pages/AlbumPage'
import { AlbumsPage } from '../pages/AlbumsPage'
import { ArtistPage } from '../pages/ArtistPage'
import { ArtistsPage } from '../pages/ArtistsPage'
import { FavouritesPage, FavouritesRedirect } from '../pages/FavouritesPage'
import { LoginPage } from '../pages/LoginPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { PlaylistPage } from '../pages/PlaylistPage'
import { SearchPage } from '../pages/SearchPage'
import { TracksPage } from '../pages/TracksPage'
import { lazyPage } from './lazy-page'

// Pages few visits open, loaded when first opened: the rest come with the app.
const setup = lazyPage(async () => {
  const { SetupPage } = await import('../pages/SetupPage')
  return <SetupPage />
})
const profile = lazyPage(async () => {
  const { ProfilePage } = await import('../pages/ProfilePage')
  return <ProfilePage />
})
const recentlyPlayed = lazyPage(async () => {
  const { HistoryPage } = await import('../pages/HistoryPage')
  return <HistoryPage view="recent" />
})
const mostPlayed = lazyPage(async () => {
  const { HistoryPage } = await import('../pages/HistoryPage')
  return <HistoryPage view="top" />
})
const users = lazyPage(async () => {
  const { UsersPage } = await import('../pages/UsersPage')
  return <UsersPage />
})
const library = lazyPage(async () => {
  const { LibraryPage } = await import('../pages/LibraryPage')
  return <LibraryPage />
})

/** Shown when the app opens on a page loaded on demand, until it has loaded. */
const loading = (
  <div className="flex min-h-svh items-center justify-center">
    <Spinner />
  </div>
)

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  // A new server, without accounts: its first visitor creates the administrator.
  { path: '/setup', lazy: setup, hydrateFallbackElement: loading },
  {
    element: <RequireAuth />,
    hydrateFallbackElement: loading,
    children: [
      {
        element: <AppLayout />,
        children: [
          // The home page: the albums added to the library last.
          { path: '/', element: <AlbumsPage recent /> },
          { path: '/artists', element: <ArtistsPage /> },
          { path: '/artists/:id', element: <ArtistPage /> },
          { path: '/albums', element: <AlbumsPage /> },
          { path: '/albums/:id', element: <AlbumPage /> },
          { path: '/tracks', element: <TracksPage /> },
          { path: '/search', element: <SearchPage /> },
          { path: '/favourites', element: <FavouritesRedirect /> },
          { path: '/favourites/artists', element: <FavouritesPage kind="artist" /> },
          { path: '/favourites/albums', element: <FavouritesPage kind="album" /> },
          { path: '/favourites/tracks', element: <FavouritesPage kind="track" /> },
          { path: '/history', element: <Navigate to="/history/recent" replace /> },
          { path: '/history/recent', lazy: recentlyPlayed },
          { path: '/history/top', lazy: mostPlayed },
          { path: '/playlists/:id', element: <PlaylistPage /> },
          { path: '/profile', lazy: profile },
          // Administrators only (the page says so to anyone else, as the API does).
          { path: '/admin/users', lazy: users },
          { path: '/admin/library', lazy: library },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
