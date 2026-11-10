import { setFavourite, useIsFavourite, type FavouriteKind } from '../library/favourites'
import { HeartFilledIcon, HeartIcon } from '../player/icons'

interface FavouriteButtonProps {
  kind: FavouriteKind
  id: string | undefined
  /** What the API said (`favourite`); a change made during the visit wins. */
  favourite: boolean | undefined
  /** The item's name, for the button's accessible name ("Favourite Killer") and the toast if it fails. */
  name: string
  className?: string
  iconClassName?: string
}

/** A heart that adds the item to the favourites, or removes it: a toggle button, pressed while it is one. */
export function FavouriteButton({ kind, id, favourite, name, className = '', iconClassName = 'h-5 w-5' }: FavouriteButtonProps) {
  const isFavourite = useIsFavourite(kind, id, favourite)

  if (!id) {
    return null
  }

  return (
    <button
      type="button"
      onClick={() => void setFavourite(kind, id, !isFavourite, name)}
      // A double click here doesn't reach the row around it (a double click on a track row plays it).
      onDoubleClick={(event) => event.stopPropagation()}
      aria-label={`Favourite ${name}`}
      aria-pressed={isFavourite}
      title={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
      className={`flex items-center justify-center hover:text-white aria-pressed:text-violet-400 aria-pressed:hover:text-violet-300 ${isFavourite ? '' : 'text-neutral-400'} ${className}`}
    >
      {isFavourite ? <HeartFilledIcon className={iconClassName} /> : <HeartIcon className={iconClassName} />}
    </button>
  )
}
