/* Pure build aggregation. Kept out of data.ts because that module is
 * server-only, and these numbers are the sort of thing that must be tested. */

export interface DynoBuild {
  slug: string;
  title: string;
  vehicleLabel: string;
  platform: string;
  heroImage: string;
  beforeHp: number | null;
  afterHp: number | null;
  beforeTorque: number | null;
  afterTorque: number | null;
  hpGain: number | null;
  torqueGain: number | null;
  isSample: boolean;
}

export interface BuildStats {
  builds: DynoBuild[];
  /** Ranked by HP gained, highest first. */
  leaderboard: DynoBuild[];
  trucks: number;
  avgHpGain: number | null;
  topTorque: number | null;
  /** True when every counted build is a shop example, so the UI can say so. */
  allSamples: boolean;
}

/**
 * Headline figures come from real builds only.
 *
 * The leaderboard still lists sample builds, because every row there carries
 * its own "Example" badge and the reader can see exactly what they are looking
 * at. An average or a "best torque" cannot be labelled that way — it is a bare
 * number presented as proof — so a shop with nothing but sample builds gets no
 * headline figures at all, and the UI drops the row rather than printing one.
 */
export function aggregateBuilds(builds: readonly DynoBuild[]): BuildStats {
  const withHp = builds.filter((b): b is DynoBuild & { hpGain: number } => b.hpGain !== null);
  const leaderboard = [...withHp].sort((a, b) => b.hpGain - a.hpGain);

  const real = builds.filter((b) => !b.isSample);
  const realWithHp = real.filter((b): b is DynoBuild & { hpGain: number } => b.hpGain !== null);
  const realTorques = real.map((b) => b.afterTorque).filter((t): t is number => t !== null);

  return {
    builds: [...builds],
    leaderboard,
    trucks: real.length,
    avgHpGain: realWithHp.length ? Math.round(realWithHp.reduce((sum, b) => sum + b.hpGain, 0) / realWithHp.length) : null,
    topTorque: realTorques.length ? Math.max(...realTorques) : null,
    allSamples: builds.length > 0 && builds.every((b) => b.isSample),
  };
}
