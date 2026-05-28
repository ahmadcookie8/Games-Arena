import heroBgDark from '../assets/hero-bg.png'
import heroBgLight from '../assets/hero-bg-light.png'

interface Props {
  intensity?: 'strong' | 'subtle' | 'quiet'
}

const opacityByIntensity: Record<NonNullable<Props['intensity']>, string> = {
  strong: 'opacity-70 dark:opacity-45',
  subtle: 'opacity-35 dark:opacity-20',
  quiet: 'opacity-[0.18] dark:opacity-[0.12]',
}

export default function PageBackdrop({ intensity = 'subtle' }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <img
        src={heroBgLight}
        alt=""
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 dark:opacity-0 ${opacityByIntensity[intensity]}`}
      />
      <img
        src={heroBgDark}
        alt=""
        className={`absolute inset-0 hidden h-full w-full object-cover transition-opacity duration-300 dark:block ${opacityByIntensity[intensity]}`}
      />
      <div className="arena-overlay absolute inset-0" />
      <div className="arena-grid absolute inset-0" />
    </div>
  )
}
