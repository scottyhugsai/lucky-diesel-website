import { Saira, Saira_Condensed } from 'next/font/google';

/**
 * Fitment's type. Both of the retailers this design was studied against set
 * their display in Saira, which is the right instinct: it is a technical
 * grotesque with a motorsport flavour that stays legible when it is condensed,
 * italic and shouting.
 *
 * Saira Condensed ships no true italic, so the lean is a controlled
 * `oblique 8deg` in globals.css rather than whatever the browser would
 * synthesise on its own.
 *
 * Imported on demand by the site layout, and preload is off on purpose so
 * visitors on the other three designs never fetch either file.
 */
export const display = Saira_Condensed({
  variable: '--font-v4-display',
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  display: 'swap',
  preload: false,
});

export const body = Saira({
  variable: '--font-v4-body',
  subsets: ['latin'],
  display: 'swap',
  preload: false,
});

export const V4_FONT_CLASS = `${display.variable} ${body.variable}`;
