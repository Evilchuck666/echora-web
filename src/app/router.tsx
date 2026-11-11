import { createBrowserRouter } from 'react-router'
import { RequireAuth } from '../auth/RequireAuth'
import { AppLayout } from '../components/AppLayout'
import { AlbumPage } from '../pages/AlbumPage'
import { AlbumsPage } from '../pages/AlbumsPage'
import { ArtistPage } from '../pages/ArtistPage'
import { ArtistsPage } from '../pages/ArtistsPage'
import { FavouritesPage, FavouritesRedirect } from '../pages/FavouritesPage'
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
          { path: '/', element: <ArtistsPage /> },
          { path: '/artists/:id', element: <ArtistPage /> },
          { path: '/albums', element: <AlbumsPage /> },
          { path: '/albums/:id', element: <AlbumPage /> },
          { path: '/tracks', element: <TracksPage /> },
          { path: '/search', element: <SearchPage /> },
          { path: '/favourites', element: <FavouritesRedirect /> },
          { path: '/favourites/artists', element: <FavouritesPage kind="artist" /> },
          { path: '/favourites/albums', element: <FavouritesPage kind="album" /> },
          { path: '/favourites/tracks', element: <FavouritesPage kind="track" /> },
          { path: '/playlists/:id', element: <PlaylistPage /> },
          { path: '/profile', element: <ProfilePage /> },
          // Administrators only (the page says so to anyone else, as the API does).
          { path: '/admin/users', element: <UsersPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
