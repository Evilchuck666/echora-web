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
import { SearchPage } from '../pages/SearchPage'
import { TracksPage } from '../pages/TracksPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
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
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
