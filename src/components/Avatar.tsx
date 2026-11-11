import { displayName, type Account } from '../account/accounts'
import { ArtistImage } from './ArtistImage'

/**
 * An account's profile picture, round, or the initial of its name. Decorative: the name is written next to it.
 * The same drawing as an artist's thumbnail.
 */
export function Avatar({ account, className = '' }: { account: Pick<Account, 'avatarUrl' | 'name' | 'username'>; className?: string }) {
  return <ArtistImage url={account.avatarUrl} name={displayName(account)} className={className} />
}
