/**
 * WCAG 2.2 "Bypass Blocks". Every design has a fixed header and, on phones, an
 * action bar — so a keyboard or screen-reader user otherwise walks the whole
 * chrome before reaching the page. Visually hidden until focused.
 */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only z-[100] focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:rounded-sm focus:border focus:border-clover focus:bg-carbon focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-chalk focus:outline-2 focus:outline-offset-2 focus:outline-clover"
    >
      Skip to content
    </a>
  );
}
