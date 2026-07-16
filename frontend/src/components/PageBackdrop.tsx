import heroDark1280Avif from '../assets/optimized/hero-dark-1280.avif'
import heroDark1280Webp from '../assets/optimized/hero-dark-1280.webp'
import heroDark1920Avif from '../assets/optimized/hero-dark-1920.avif'
import heroDark1920Webp from '../assets/optimized/hero-dark-1920.webp'
import heroLight1280Avif from '../assets/optimized/hero-light-1280.avif'
import heroLight1280Webp from '../assets/optimized/hero-light-1280.webp'
import heroLight1920Avif from '../assets/optimized/hero-light-1920.avif'
import heroLight1920Webp from '../assets/optimized/hero-light-1920.webp'
import { useTheme } from './ThemeProvider'

interface PageBackdropProps {
  intensity?: 'strong' | 'subtle' | 'quiet'
}

const opacityByIntensity: Record<NonNullable<PageBackdropProps['intensity']>, string> = {
  strong: 'opacity-70 dark:opacity-45',
  subtle: 'opacity-35 dark:opacity-20',
  quiet: 'opacity-[0.18] dark:opacity-[0.12]',
}

export default function PageBackdrop({ intensity = 'subtle' }: PageBackdropProps) {
  const { resolvedTheme } = useTheme()
  const backdrop = resolvedTheme === 'dark'
    ? {
        avif: `${heroDark1280Avif} 1280w, ${heroDark1920Avif} 1920w`,
        webp: `${heroDark1280Webp} 1280w, ${heroDark1920Webp} 1920w`,
        fallback: heroDark1920Webp,
      }
    : {
        avif: `${heroLight1280Avif} 1280w, ${heroLight1920Avif} 1920w`,
        webp: `${heroLight1280Webp} 1280w, ${heroLight1920Webp} 1920w`,
        fallback: heroLight1920Webp,
      }

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <picture key={resolvedTheme}>
        <source type="image/avif" srcSet={backdrop.avif} sizes="100vw" />
        <source type="image/webp" srcSet={backdrop.webp} sizes="100vw" />
        <img
          src={backdrop.fallback}
          alt=""
          decoding="async"
          loading={intensity === 'strong' ? 'eager' : 'lazy'}
          {...{ fetchpriority: intensity === 'strong' ? 'high' : 'low' }}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-240 ${opacityByIntensity[intensity]}`}
        />
      </picture>
      <div className="arena-overlay absolute inset-0" />
      <div className="arena-grid absolute inset-0" />
    </div>
  )
}
