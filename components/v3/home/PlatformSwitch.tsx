import Link from 'next/link';
import { PLATFORMS } from '@/lib/site';

/** Segmented control: three platforms, one tap each. Zero radius so it reads as an instrument, not a button row. */
export function PlatformSwitch({ className = '' }: { className?: string }) {
  return (
    <nav aria-label="Pick your truck" className={className}>
      <ul className="grid grid-cols-3 border border-chalk/20 bg-carbon/70">
        {PLATFORMS.map((platform, index) => (
          <li key={platform.id} className={index > 0 ? 'border-l border-chalk/20' : ''}>
            <Link href={`/${platform.id}`} className="v3-seg flex min-h-13 flex-col items-center justify-center px-2 py-2 text-center transition-colors hover:bg-clover hover:text-carbon focus-visible:bg-clover focus-visible:text-carbon">
              <span className="text-sm font-semibold sm:text-[0.9375rem]">{platform.name}</span>
              <span className="v3-mono text-[0.625rem] uppercase tracking-[0.12em] opacity-70">{platform.make}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
