import { createBrowserRouter, Navigate } from 'react-router'
import { RequireAuth } from '../auth/RequireAuth'
import { AppLayout } from '../components/AppLayout'
import { AlbumPage } from '../pages/AlbumPage'
import { AlbumsPage } from '../pages/AlbumsPage'
import { ArtistPage } from '../pages/ArtistPage'
import { ArtistsPage } from '../pages/ArtistsPage'
import { FavouritesPage, FavouritesRedirect } from '../pages/FavouritesPage'
import { HistoryPage } from '../pages/HistoryPage'
import { LibraryPage } from '../pages/LibraryPage'
import { LoginPage } from '../pages/LoginPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { PlaylistPage } from '../pages/PlaylistPage'
import { ProfilePage } from '../pages/ProfilePage'
import { SearchPage } from '../pages/SearchPage'
import { SetupPage } from '../pages/SetupPage'
import { TracksPage } from '../pages/TracksPage'
import { UsersPage } from '../pages/UsersPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  // A new server, without accounts: its first visitor creates the administrator.
  { path: '/setup', element: <SetupPage /> },
  {
    element: <RequireAuth />,
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
          { path: '/history/recent', element: <HistoryPage view="recent" /> },
          { path: '/history/top', element: <HistoryPage view="top" /> },
          { path: '/playlists/:id', element: <PlaylistPage /> },
          { path: '/profile', element: <ProfilePage /> },
          // Administrators only (the page says so to anyone else, as the API does).
          { path: '/admin/users', element: <UsersPage /> },
          { path: '/admin/library', element: <LibraryPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
