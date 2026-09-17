import Link from 'next/link';

type Tone = 'carbon' | 'carbon-2';

interface BandProps {
  id?: string;
  tone?: Tone;
  labelledBy: string;
  className?: string;
  children: React.ReactNode;
}

/** One full-bleed page band. Alternating tones give the Apple-style section rhythm. */
export function Band({ id, tone = 'carbon', labelledBy, className = '', children }: BandProps) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={`${tone === 'carbon' ? 'bg-carbon' : 'bg-carbon-2'} py-20 sm:py-28 lg:py-32 ${className}`}
    >
      {children}
    </section>
  );
}

interface HeadingProps {
  id: string;
  title: string;
  line?: string;
  align?: 'center' | 'left';
}

/** Big tight headline plus one short line. */
export function SectionHeading({ id, title, line, align = 'center' }: HeadingProps) {
  return (
    <div className={align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}>
      <h2 id={id} className="v2-title text-[clamp(2.25rem,1.4rem+3.4vw,4rem)]">
        {title}
      </h2>
      {line && <p className="mt-4 text-[19px] leading-snug text-chalk/70 sm:text-[22px]">{line}</p>}
    </div>
  );
}

interface LinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const PILL_SIZE = {
  sm: 'h-8 px-3.5 text-[13px]',
  md: 'h-11 px-5 text-[15px]',
  lg: 'h-12 px-6 text-[17px]',
} as const;

/** Filled clover pill. */
export function PillLink({ href, children, className = '', size = 'md' }: LinkProps) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center rounded-full bg-clover font-medium text-carbon transition-[filter,transform] duration-200 hover:brightness-110 active:scale-[0.98] ${PILL_SIZE[size]} ${className}`}
    >
      {children}
    </Link>
  );
}

/** Apple-style "Learn more ›" text link. */
export function TextLink({ href, children, className = '', size = 'md' }: LinkProps) {
  const text = size === 'lg' ? 'text-[19px]' : size === 'sm' ? 'text-[14px]' : 'text-[17px]';
  return (
    <Link href={href} className={`v2-link inline-flex items-center gap-0.5 font-normal text-clover ${text} ${className}`}>
      <span>{children}</span>
      <span aria-hidden="true" className="translate-y-px text-[1.15em] leading-none">›</span>
    </Link>
  );
}
