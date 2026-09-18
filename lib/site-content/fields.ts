/**
 * Field vocabulary for the site control panel. The *shape* of every editable
 * block lives in code (see registry.ts) so the admin form, its validation and
 * the public fallback all come from one definition. The database only ever
 * stores values.
 */

export type FieldValue = string | boolean | readonly string[];
export type BlockValues = Readonly<Record<string, FieldValue>>;

interface FieldBase {
  name: string;
  label: string;
  help?: string;
}

/** Single-line copy. `maxWords` enforces the site's short-copy rule. */
export interface TextField extends FieldBase {
  kind: 'text' | 'textarea' | 'url';
  max: number;
  maxWords?: number;
}

export interface BooleanField extends FieldBase {
  kind: 'boolean';
}

export interface SelectField extends FieldBase {
  kind: 'select';
  options: readonly { value: string; label: string }[];
}

/** A picture from the media library, or one of the shipped `/images` assets. */
export interface ImageField extends FieldBase {
  kind: 'image';
}

/** An ordered subset of known ids — homepage section order, nav destinations. */
export interface ListField extends FieldBase {
  kind: 'list';
  options: readonly { value: string; label: string }[];
  min?: number;
  max?: number;
}

export type Field = TextField | BooleanField | SelectField | ImageField | ListField;

export type BlockGroup = 'announcement' | 'home' | 'pages' | 'platforms' | 'nav' | 'seo';

export interface BlockDef {
  /** Stable storage key, e.g. `home.hero`. */
  key: string;
  group: BlockGroup;
  title: string;
  description?: string;
  fields: readonly Field[];
  /** Shown when nothing is published — the site never renders blank. */
  defaults: BlockValues;
  /** Per-design shipped copy, where a design words something differently. */
  designDefaults?: Readonly<Record<string, BlockValues>>;
}

/** The copy this block ships with for a given design. */
export function defaultsFor(def: BlockDef, design?: string): BlockValues {
  const overrides = design && design !== 'all' ? def.designDefaults?.[design] : undefined;
  return overrides ? { ...def.defaults, ...overrides } : def.defaults;
}

export function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}
