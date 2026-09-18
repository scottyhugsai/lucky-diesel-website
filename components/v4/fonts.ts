import { Inter_Tight } from 'next/font/google';

/**
 * Vector runs on one family, set tight. Imported on demand by the site layout;
 * preload is off so visitors on the other three designs never fetch it.
 */
export const interTight = Inter_Tight({
  variable: '--font-v4-family',
  subsets: ['latin'],
  display: 'swap',
  preload: false,
});

export const V4_FONT_CLASS = interTight.variable;
