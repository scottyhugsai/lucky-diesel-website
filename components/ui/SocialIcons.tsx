import { BUSINESS } from '@/lib/site';

const ICONS = {
  instagram: (
    <path d="M12 2.2c3.2 0 3.6 0 4.8.1 3.3.1 4.8 1.7 4.9 4.9.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.2-1.7 4.8-4.9 4.9-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-3.3-.1-4.8-1.7-4.9-4.9C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8C2.4 3.9 3.9 2.4 7.2 2.3 8.4 2.2 8.8 2.2 12 2.2zm0 4.9a4.9 4.9 0 1 0 0 9.8 4.9 4.9 0 0 0 0-9.8zm0 8.1a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4zm5.1-9.5a1.15 1.15 0 1 0 0 2.3 1.15 1.15 0 0 0 0-2.3z" />
  ),
  facebook: (
    <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z" />
  ),
  tiktok: (
    <path d="M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3.1v12.4a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.7a5.7 5.7 0 1 0 4.9 5.7V9.1a7.3 7.3 0 0 0 4.3 1.4V7.4a4.3 4.3 0 0 1-3.2-1.6z" />
  ),
} as const;

const LABELS: Record<keyof typeof ICONS, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
};

export function SocialIcons({ className = '' }: { className?: string }) {
  return (
    <ul className={`flex gap-2 ${className}`}>
      {(Object.keys(ICONS) as (keyof typeof ICONS)[]).map((key) => (
        <li key={key}>
          <a
            href={BUSINESS.social[key]}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Lucky Diesel on ${LABELS[key]}`}
            className="grid size-11 place-items-center rounded-full border border-line text-chalk transition-colors duration-200 hover:border-clover hover:bg-clover hover:text-carbon"
          >
            <svg viewBox="0 0 24 24" className="size-[18px] fill-current" aria-hidden="true">
              {ICONS[key]}
            </svg>
          </a>
        </li>
      ))}
    </ul>
  );
}
