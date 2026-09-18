'use client';

import { useState } from 'react';
import { fieldClass } from '@/components/app/ui';
import { wordCount } from '@/lib/site-content/fields';

/**
 * Text input that shows how close the copy is to the site's limits while it is
 * being typed. The site's short-copy rule is the whole reason the limits exist,
 * so the owner should see it before the server rejects the save.
 */
export function CountedField({ name, initial, max, maxWords, multiline, placeholder }: {
  name: string;
  initial: string;
  max: number;
  maxWords?: number;
  multiline?: boolean;
  placeholder?: string;
}) {
  const [value, setValue] = useState(initial);
  const words = wordCount(value);
  const overWords = maxWords !== undefined && words > maxWords;
  const overChars = value.length > max;
  const props = {
    name,
    value,
    placeholder,
    maxLength: max + 40,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValue(event.target.value),
    className: `${fieldClass} ${overWords || overChars ? 'border-danger' : ''}`,
    'aria-invalid': overWords || overChars,
  };

  return (
    <>
      {multiline ? <textarea {...props} rows={3} /> : <input {...props} />}
      <p className={`mt-1 text-xs tabular-nums ${overWords || overChars ? 'text-danger' : 'text-steel'}`}>
        {maxWords !== undefined && <>{words}/{maxWords} words · </>}
        {value.length}/{max} characters
        {overWords && <> — too long to save</>}
      </p>
    </>
  );
}
