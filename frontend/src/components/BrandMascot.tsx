import mascot160Webp from '../assets/optimized/mascot-160.webp'
import mascot320Webp from '../assets/optimized/mascot-320.webp'

interface BrandMascotProps {
  className?: string
  sizes?: string
  eager?: boolean
  alt?: string
}

export default function BrandMascot({
  className,
  sizes = '80px',
  eager = false,
  alt = '',
}: BrandMascotProps) {
  return (
    <picture>
      <source type="image/webp" srcSet={`${mascot160Webp} 160w, ${mascot320Webp} 320w`} sizes={sizes} />
      <img
        src={mascot160Webp}
        srcSet={`${mascot160Webp} 160w, ${mascot320Webp} 320w`}
        sizes={sizes}
        alt={alt}
        width={160}
        height={186}
        loading={eager ? 'eager' : 'lazy'}
        {...{ fetchpriority: eager ? 'high' : 'auto' }}
        decoding="async"
        className={className}
      />
    </picture>
  )
}
