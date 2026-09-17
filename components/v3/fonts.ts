import { JetBrains_Mono, Space_Grotesk } from 'next/font/google';

/**
 * Telemetry type. Imported on demand by the site layout. preload is off on
 * purpose: Next would otherwise emit <link rel=preload> for every design, and
 * a browser only fetches an @font-face that rendered text actually uses, so
 * v1/v2 visitors never download these files.
 */
export const spaceGrotesk = Space_Grotesk({
  variable: '--font-v3-display',
  subsets: ['latin'],
  display: 'swap',
  preload: false,
});

export const jetBrainsMono = JetBrains_Mono({
  variable: '--font-v3-mono',
  subsets: ['latin'],
  display: 'swap',
  preload: false,
});

export const V3_FONT_CLASS = `${spaceGrotesk.variable} ${jetBrainsMono.variable}`;
