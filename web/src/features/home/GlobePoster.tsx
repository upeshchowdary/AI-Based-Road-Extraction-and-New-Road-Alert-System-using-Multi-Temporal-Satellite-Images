import { cn } from '@/lib/cn'

/**
 * Static/CSS globe: the hero poster while WebGL loads, and the whole globe on the low tier.
 * Uses the same NASA Blue Marble texture as the 3D scene, shaded with inset light.
 */
export function GlobePoster({ className, spin = true }: { className?: string; spin?: boolean }) {
  return (
    <div aria-hidden className={cn('pointer-events-none absolute', className)}>
      <div
        className="absolute inset-[-9%] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(108,201,240,0.16) 52%, rgba(108,201,240,0.05) 62%, transparent 70%)' }}
      />
      <div
        className={cn('relative size-full overflow-hidden rounded-full', spin && 'rw-poster-spin')}
        style={{
          backgroundImage: 'url(/textures/earth-day-2k.webp)',
          backgroundSize: '210% 112%',
          backgroundPosition: '94% 38%',
          boxShadow:
            'inset -34px -18px 70px 18px rgba(2,4,8,0.92), inset 14px 8px 30px rgba(108,201,240,0.28), 0 0 60px rgba(79,209,232,0.12)',
        }}
      />
    </div>
  )
}
