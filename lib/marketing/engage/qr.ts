/**
 * Minimal QR Code encoder (ISO/IEC 18004): byte mode, error correction level M,
 * versions 1–10 (up to 213 bytes, plenty for a short link). Pure and dependency-free,
 * so the admin can render placement QR codes as inline SVG.
 */

/** [EC codewords per block, blocks, total codewords] for level M, versions 1–10. */
const LEVEL_M: readonly (readonly [number, number, number])[] = [
  [10, 1, 26], [16, 1, 44], [26, 1, 70], [18, 2, 100], [24, 2, 134],
  [16, 4, 172], [18, 4, 196], [22, 4, 242], [22, 5, 292], [26, 5, 346],
];

const ALIGNMENT: readonly (readonly number[])[] = [
  [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50],
];

const MAX_VERSION = 10;
const FORMAT_BITS_M = 0;
const PAD_BYTES = [0xec, 0x11] as const;

export interface QrMatrix {
  version: number;
  size: number;
  /** modules[y][x] = true for a dark module. */
  modules: boolean[][];
}

function gfMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function rsDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMultiply(result[j]!, root);
      if (j + 1 < degree) result[j] = result[j]! ^ result[j + 1]!;
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

function rsRemainder(data: readonly number[], divisor: readonly number[]): number[] {
  const result = divisor.map(() => 0);
  for (const byte of data) {
    const factor = byte ^ result.shift()!;
    result.push(0);
    divisor.forEach((coef, i) => { result[i] = result[i]! ^ gfMultiply(coef, factor); });
  }
  return result;
}

function dataCapacity(version: number): number {
  const [ecc, blocks, total] = LEVEL_M[version - 1]!;
  return total - ecc * blocks;
}

/** Smallest version that fits `length` bytes, or null when the text is too long. */
export function pickVersion(length: number): number | null {
  for (let v = 1; v <= MAX_VERSION; v++) {
    const countBits = v < 10 ? 8 : 16;
    if (4 + countBits + length * 8 <= dataCapacity(v) * 8) return v;
  }
  return null;
}

function encodeData(bytes: readonly number[], version: number): number[] {
  const bits: number[] = [];
  const push = (value: number, length: number) => { for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
  const capacityBits = dataCapacity(version) * 8;
  push(0b0100, 4);
  push(bytes.length, version < 10 ? 8 : 16);
  bytes.forEach((b) => push(b, 8));
  push(0, Math.min(4, capacityBits - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) codewords.push(bits.slice(i, i + 8).reduce((acc, bit) => (acc << 1) | bit, 0));
  for (let i = 0; codewords.length < dataCapacity(version); i++) codewords.push(PAD_BYTES[i % 2]!);
  return codewords;
}

function addErrorCorrection(data: readonly number[], version: number): number[] {
  const [eccLen, numBlocks, total] = LEVEL_M[version - 1]!;
  const shortLen = Math.floor(total / numBlocks) - eccLen;
  const numShort = numBlocks - (total % numBlocks);
  const divisor = rsDivisor(eccLen);
  const blocks: number[][] = [];
  const eccs: number[][] = [];
  let offset = 0;
  for (let i = 0; i < numBlocks; i++) {
    const block = data.slice(offset, offset + shortLen + (i < numShort ? 0 : 1));
    offset += block.length;
    blocks.push(block);
    eccs.push(rsRemainder(block, divisor));
  }
  const out: number[] = [];
  for (let i = 0; i <= shortLen; i++) blocks.forEach((b) => { if (i < b.length) out.push(b[i]!); });
  for (let i = 0; i < eccLen; i++) eccs.forEach((e) => out.push(e[i]!));
  return out;
}

class Grid {
  readonly modules: boolean[][];
  readonly isFunction: boolean[][];
  constructor(readonly size: number) {
    this.modules = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
    this.isFunction = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  }
  setFunction(x: number, y: number, dark: boolean): void {
    this.modules[y]![x] = dark;
    this.isFunction[y]![x] = true;
  }
}

function drawFunctionPatterns(grid: Grid, version: number): void {
  const { size } = grid;
  for (let i = 0; i < size; i++) {
    grid.setFunction(6, i, i % 2 === 0);
    grid.setFunction(i, 6, i % 2 === 0);
  }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]] as const) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        if (x >= 0 && x < size && y >= 0 && y < size) grid.setFunction(x, y, dist !== 2 && dist !== 4);
      }
    }
  }
  const positions = ALIGNMENT[version - 1]!;
  const last = positions.length - 1;
  positions.forEach((ax, i) => positions.forEach((ay, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) grid.setFunction(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }));
  drawFormatBits(grid, 0);
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >>> i) & 1) === 1;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      grid.setFunction(a, b, dark);
      grid.setFunction(b, a, dark);
    }
  }
}

/** BCH(15,5) format information for level M and the given mask. */
export function formatBits(mask: number): number {
  const data = (FORMAT_BITS_M << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

function drawFormatBits(grid: Grid, mask: number): void {
  const bits = formatBits(mask);
  const bit = (i: number) => ((bits >>> i) & 1) === 1;
  const { size } = grid;
  for (let i = 0; i <= 5; i++) grid.setFunction(8, i, bit(i));
  grid.setFunction(8, 7, bit(6));
  grid.setFunction(8, 8, bit(7));
  grid.setFunction(7, 8, bit(8));
  for (let i = 9; i < 15; i++) grid.setFunction(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) grid.setFunction(size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) grid.setFunction(8, size - 15 + i, bit(i));
  grid.setFunction(8, size - 8, true);
}

function drawCodewords(grid: Grid, codewords: readonly number[]): void {
  const { size } = grid;
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!grid.isFunction[y]![x] && i < codewords.length * 8) {
          grid.modules[y]![x] = ((codewords[i >>> 3]! >>> (7 - (i & 7))) & 1) === 1;
          i++;
        }
      }
    }
  }
}

const MASKS: readonly ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function applyMask(grid: Grid, mask: number): void {
  const test = MASKS[mask]!;
  for (let y = 0; y < grid.size; y++) {
    for (let x = 0; x < grid.size; x++) {
      if (!grid.isFunction[y]![x] && test(x, y)) grid.modules[y]![x] = !grid.modules[y]![x];
    }
  }
}

const FINDER_LIKE = [
  [true, false, true, true, true, false, true, false, false, false, false],
  [false, false, false, false, true, false, true, true, true, false, true],
];

function lineRuns(line: readonly boolean[]): number {
  let penalty = 0;
  let run = 1;
  for (let i = 1; i <= line.length; i++) {
    if (i < line.length && line[i] === line[i - 1]) {
      run++;
      continue;
    }
    if (run >= 5) penalty += 3 + (run - 5);
    run = 1;
  }
  for (let i = 0; i + 11 <= line.length; i++) {
    if (FINDER_LIKE.some((pattern) => pattern.every((v, k) => line[i + k] === v))) penalty += 40;
  }
  return penalty;
}

/** Standard penalty score (runs, 2×2 blocks, finder-like patterns, dark balance). Lower is better. */
export function penaltyScore(modules: readonly (readonly boolean[])[]): number {
  const size = modules.length;
  let penalty = 0;
  let dark = 0;
  for (let y = 0; y < size; y++) {
    penalty += lineRuns(modules[y]!);
    penalty += lineRuns(modules.map((row) => row[y]!));
    for (let x = 0; x < size; x++) {
      if (modules[y]![x]) dark++;
      if (x + 1 < size && y + 1 < size) {
        const c = modules[y]![x];
        if (modules[y]![x + 1] === c && modules[y + 1]![x] === c && modules[y + 1]![x + 1] === c) penalty += 3;
      }
    }
  }
  const total = size * size;
  penalty += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
  return penalty;
}

/** Encodes UTF-8 text. Returns null when it doesn't fit version 10-M (213 bytes). */
export function encodeQr(text: string): QrMatrix | null {
  const bytes = [...new TextEncoder().encode(text)];
  const version = pickVersion(bytes.length);
  if (!version) return null;
  const codewords = addErrorCorrection(encodeData(bytes, version), version);
  const size = version * 4 + 17;

  let best: { grid: Grid; score: number } | null = null;
  for (let mask = 0; mask < MASKS.length; mask++) {
    const grid = new Grid(size);
    drawFunctionPatterns(grid, version);
    drawCodewords(grid, codewords);
    applyMask(grid, mask);
    drawFormatBits(grid, mask);
    const score = penaltyScore(grid.modules);
    if (!best || score < best.score) best = { grid, score };
  }
  return { version, size, modules: best!.grid.modules };
}

/** One SVG path ("M x y h1v1h-1z" per dark module) with a 4-module quiet zone. */
export function qrSvgPath(matrix: QrMatrix, quiet = 4): { path: string; viewBox: number } {
  const parts: string[] = [];
  matrix.modules.forEach((row, y) => row.forEach((dark, x) => { if (dark) parts.push(`M${x + quiet} ${y + quiet}h1v1h-1z`); }));
  return { path: parts.join(''), viewBox: matrix.size + quiet * 2 };
}
