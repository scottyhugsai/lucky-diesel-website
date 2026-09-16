'use client';

import { Check, Link2, Printer } from 'lucide-react';
import { useState } from 'react';
import { buttonClass } from '@/components/app/ui';

export function CopyPayLink({ path }: { path: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function copy() {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setState('copied');
    } catch {
      window.prompt('Copy the pay link:', url);
      setState('failed');
    }
    window.setTimeout(() => setState('idle'), 2500);
  }

  return (
    <button type="button" onClick={copy} className={buttonClass('secondary', 'sm')} aria-live="polite">
      {state === 'copied' ? <Check className="size-4 text-clover" aria-hidden="true" /> : <Link2 className="size-4" aria-hidden="true" />}
      {state === 'copied' ? 'Link copied' : 'Copy pay link'}
    </button>
  );
}

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass('secondary', 'sm')}>
      <Printer className="size-4" aria-hidden="true" /> Print
    </button>
  );
}
