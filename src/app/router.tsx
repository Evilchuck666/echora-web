import { createBrowserRouter } from 'react-router'
import { RequireAuth } from '../auth/RequireAuth'
import { AppLayout } from '../components/AppLayout'
import { AlbumPage } from '../pages/AlbumPage'
import { ArtistPage } from '../pages/ArtistPage'
import { ArtistsPage } from '../pages/ArtistsPage'
import { FavouritesPage } from '../pages/FavouritesPage'
import { LoginPage } from '../pages/LoginPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { SearchPage } from '../pages/SearchPage'

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
          { path: '/albums/:id', element: <AlbumPage /> },
          { path: '/search', element: <SearchPage /> },
          { path: '/favourites', element: <FavouritesPage kind="track" /> },
          { path: '/favourites/albums', element: <FavouritesPage kind="album" /> },
          { path: '/favourites/artists', element: <FavouritesPage kind="artist" /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
