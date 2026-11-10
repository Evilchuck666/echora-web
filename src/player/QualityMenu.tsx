import { ActionsMenu } from '../components/ActionsMenu'
import { canPlayOpus, setQuality } from './engine'
import { QualityIcon } from './icons'
import { usePlayer, type Quality } from './store'

const LABELS: Record<Quality, string> = { original: 'Original', 'data-saver': 'Data saver' }

/**
 * Original files or data saver (FLAC played as Opus, about a quarter of the size: for mobile networks). Remembered;
 * the gauge turns violet while the data saver is on.
 */
export function QualityMenu() {
  const quality = usePlayer((state) => state.quality)
  const opus = canPlayOpus()

  return (
    <ActionsMenu
      label={`Audio quality: ${LABELS[quality]}`}
      icon={<QualityIcon />}
      buttonClassName={`p-1 hover:text-white ${quality === 'data-saver' ? 'text-violet-400' : 'text-neutral-300'}`}
      wide
      actions={[
        {
          label: LABELS.original,
          description: 'Original files as they are (FLAC, MP3)',
          checked: quality === 'original',
          onSelect: () => setQuality('original'),
        },
        {
          label: LABELS['data-saver'],
          description: opus ? 'Opus 320 kbps' : "This browser doesn't play Opus",
          checked: quality === 'data-saver',
          disabled: !opus,
          onSelect: () => setQuality('data-saver'),
        },
      ]}
    />
  )
}
