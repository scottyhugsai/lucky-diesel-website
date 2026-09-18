'use client';

import { useEffect } from 'react';

/**
 * Progressive enhancement for the fitment picker: with JS on, choosing an
 * option submits its step immediately, so it feels like a widget. With JS off,
 * the same markup is four ordinary GET forms with a visible Go button.
 *
 * One delegated listener on the container, so it keeps working no matter how
 * many steps the server rendered.
 */
export function AutoSubmit({ selector }: { selector: string }) {
  useEffect(() => {
    const root = document.querySelector(selector);
    if (!root) return;

    const onChange = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement) || !target.form) return;
      target.form.requestSubmit();
    };

    root.addEventListener('change', onChange);
    return () => root.removeEventListener('change', onChange);
  }, [selector]);

  return null;
}
