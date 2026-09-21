/**
 * What actually moved between two layout-run captures.
 *
 *   node scripts/audit/layout-diff.mjs .audit/before .audit/after
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const load = (dir) => JSON.parse(readFileSync(path.join(dir, 'layout.json'), 'utf8'));
const [before, after] = [load(process.argv[2]), load(process.argv[3])];

const moved = [];
const recoloured = [];
let same = 0;
let gained = 0;
let lost = 0;

for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
  const a = before[key] ?? [];
  const b = after[key] ?? [];
  if (b.length > a.length) gained += b.length - a.length;
  if (a.length > b.length) lost += a.length - b.length;

  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    const [x, y] = [a[i], b[i]];
    const geometry = x.box.join(',') !== y.box.join(',');
    const paint = x.bg !== y.bg || x.color !== y.color || x.borderColor !== y.borderColor || x.radius !== y.radius;
    if (geometry) moved.push(`${key} #${i} ${x.cls || x.tag}: ${x.box.join(',')} -> ${y.box.join(',')}  ${JSON.stringify(x.text).slice(0, 30)}`);
    if (paint) recoloured.push(`${key} #${i} ${x.cls || x.tag}: ${x.bg}/${x.borderColor}/${x.radius} -> ${y.bg}/${y.borderColor}/${y.radius}`);
    if (!geometry && !paint) same += 1;
  }
}

const show = (title, rows) => {
  console.log(`\n${title}: ${rows.length}`);
  for (const row of rows.slice(0, 40)) console.log('  ' + row);
  if (rows.length > 40) console.log(`  ...and ${rows.length - 40} more`);
};
show('MOVED', moved);
show('RECOLOURED', recoloured);
console.log(`\nunchanged: ${same}   panels added: ${gained}   removed: ${lost}`);
