import { ActionsMenu } from '../components/ActionsMenu'
import { canPlayOpus, setLeveling, setQuality } from './engine'
import { QualityIcon } from './icons'
import { usePlayer, type Leveling, type Quality } from './store'

const LABELS: Record<Quality, string> = { original: 'Original', 'data-saver': 'Data saver' }
const LEVELING: Record<Leveling, string> = { off: 'Off', track: 'Track', auto: 'Auto' }

/**
 * How the music sounds, remembered: original files or data saver (FLAC played as Opus, about a quarter of the size:
 * for mobile networks), and volume leveling with the tracks' ReplayGain tags. The gauge turns violet while the data
 * saver is on.
 */
export function QualityMenu() {
  const quality = usePlayer((state) => state.quality)
  const leveling = usePlayer((state) => state.leveling)
  const opus = canPlayOpus()

  return (
    <ActionsMenu
      label={`Audio quality: ${LABELS[quality]}. Volume leveling: ${LEVELING[leveling]}`}
      icon={<QualityIcon />}
      buttonClassName={`p-1 hover:text-white ${quality === 'data-saver' ? 'text-violet-400' : 'text-neutral-300'}`}
      wide
      actions={[
        {
          section: 'Quality',
          label: LABELS.original,
          description: 'Original files as they are (FLAC, MP3)',
          checked: quality === 'original',
          onSelect: () => setQuality('original'),
        },
        {
          section: 'Quality',
          label: LABELS['data-saver'],
          description: opus ? 'Opus 320 kbps' : "This browser doesn't play Opus",
          checked: quality === 'data-saver',
          disabled: !opus,
          onSelect: () => setQuality('data-saver'),
        },
        {
          section: 'Volume leveling',
          label: LEVELING.auto,
          description: 'Albums played whole keep their dynamics; the rest track by track',
          checked: leveling === 'auto',
          onSelect: () => setLeveling('auto'),
        },
        {
          section: 'Volume leveling',
          label: LEVELING.track,
          description: 'Every track as loud as the others',
          checked: leveling === 'track',
          onSelect: () => setLeveling('track'),
        },
        {
          section: 'Volume leveling',
          label: LEVELING.off,
          description: 'Tracks as loud as their files',
          checked: leveling === 'off',
          onSelect: () => setLeveling('off'),
        },
      ]}
    />
  )
}
