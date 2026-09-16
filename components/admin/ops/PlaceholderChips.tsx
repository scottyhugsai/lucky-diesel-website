'use client';

/** Buttons that insert {{placeholders}} at the cursor of the last focused template field. */
export function PlaceholderChips({ names, onInsert }: { names: string[]; onInsert: (token: string) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-steel">Insert a placeholder</p>
      <ul className="flex flex-wrap gap-1.5">
        {names.map((name) => (
          <li key={name}>
            <button
              type="button"
              // Keep focus (and the caret) in the template field.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onInsert(`{{${name}}}`)}
              className="rounded-sm border border-clover/30 bg-clover/[0.07] px-2 py-1 font-mono text-xs text-clover transition-colors hover:border-clover hover:bg-clover/15 active:translate-y-px"
            >
              {name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
