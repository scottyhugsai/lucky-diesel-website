import type { BlockValues } from './fields';

/** Typed reads off a block. Values are validated on the way in, so these are
 *  narrowing helpers rather than parsers. */
export function str(values: BlockValues, name: string): string {
  const value = values[name];
  return typeof value === 'string' ? value : '';
}

export function bool(values: BlockValues, name: string): boolean {
  return values[name] === true;
}

export function list(values: BlockValues, name: string): readonly string[] {
  const value = values[name];
  return Array.isArray(value) ? value : [];
}

/** A headline typed as several lines. Designs that want one line join them. */
export function lines(values: BlockValues, name: string): string[] {
  return str(values, name).split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 3);
}
