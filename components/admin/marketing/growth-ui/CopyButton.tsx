'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

const RESET_MS = 1800;

export function CopyButton({ value, label = 'Copy link' }: { value: string; label?: string }) {
  const [isCopied, setIsCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), RESET_MS);
    } catch {
      window.prompt('Copy this link', value);
    }
  }
  return (
    <button type="button" onClick={copy} className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-line px-2.5 text-xs font-semibold text-chalk/80 hover:border-clover hover:text-clover">
      {isCopied ? <Check className="size-3.5 text-clover" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
      <span aria-live="polite">{isCopied ? 'Copied' : label}</span>
    </button>
  );
}
