/**
 * Reading progress under the header. Scrubbed entirely by CSS
 * `animation-timeline: scroll()`, so it costs no JavaScript and never runs on
 * the main thread. Decorative, so it is hidden from assistive tech.
 */
export function ScrollProgress() {
  return (
    <div aria-hidden="true" className="pointer-events-none sticky top-14 z-40 h-px w-full bg-line">
      <div className="v4-progress h-px w-full bg-clover" />
    </div>
  );
}
