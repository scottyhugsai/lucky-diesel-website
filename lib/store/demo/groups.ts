import type { PlatformId } from '../normalize';
import { findTruck } from './trucks';

/** One truck generation a sample product is listed for. */
export interface TruckFit {
  truckId: string;
  generationId: string;
}

export interface FitmentGroup {
  id: string;
  /** Short form for product titles: '2011–2016 Duramax LML'. */
  short: string;
  /** Full fitment lines for the product page. */
  labels: readonly string[];
  platforms: readonly PlatformId[];
  generationCollections: readonly string[];
  fits: readonly TruckFit[];
  tags: readonly string[];
}

interface GroupSpec {
  id: string;
  short: string;
  labels: readonly string[];
  platforms: readonly PlatformId[];
  models: readonly string[];
  generations: readonly string[];
  tags: readonly string[];
}

const GM_HD = ['chevrolet-silverado-2500hd', 'chevrolet-silverado-3500hd', 'gmc-sierra-2500hd', 'gmc-sierra-3500hd'] as const;
const GM_LD = ['chevrolet-silverado-1500', 'gmc-sierra-1500'] as const;
const FORD_SD = ['ford-f-250', 'ford-f-350'] as const;
const FORD_SD_450 = ['ford-f-250', 'ford-f-350', 'ford-f-450'] as const;
const RAM_HD = ['ram-2500', 'ram-3500'] as const;
const RAM_HD_4500 = ['ram-2500', 'ram-3500', 'ram-4500'] as const;

const GM_HD_TAGS = ['chevrolet', 'gmc', 'silverado', 'sierra', '2500hd', '3500hd', 'duramax'] as const;
const FORD_SD_TAGS = ['ford', 'f-250', 'f-350', 'super-duty', 'powerstroke'] as const;
const RAM_HD_TAGS = ['ram', 'dodge', '2500', '3500', 'cummins'] as const;

const SPECS: readonly GroupSpec[] = [
  { id: 'dmax-lb7', short: '2001–2004 Duramax LB7', labels: ['2001–2004 Chevrolet Silverado / GMC Sierra 2500HD/3500 6.6L Duramax LB7'], platforms: ['duramax'], models: GM_HD, generations: ['gmhd-2001-2004'], tags: [...GM_HD_TAGS, 'lb7'] },
  { id: 'dmax-lly', short: '2004.5–2005 Duramax LLY', labels: ['2004.5–2005 Chevrolet Silverado / GMC Sierra 2500HD/3500 6.6L Duramax LLY'], platforms: ['duramax'], models: GM_HD, generations: ['gmhd-2005'], tags: [...GM_HD_TAGS, 'lly'] },
  { id: 'dmax-lbz', short: '2006–2007 Duramax LBZ', labels: ['2006–2007 Chevrolet Silverado / GMC Sierra 2500HD/3500 6.6L Duramax LBZ'], platforms: ['duramax'], models: GM_HD, generations: ['gmhd-2006-2007'], tags: [...GM_HD_TAGS, 'lbz'] },
  { id: 'dmax-lmm', short: '2007.5–2010 Duramax LMM', labels: ['2007.5–2010 Chevrolet Silverado / GMC Sierra 2500HD/3500HD 6.6L Duramax LMM'], platforms: ['duramax'], models: GM_HD, generations: ['gmhd-2008-2010'], tags: [...GM_HD_TAGS, 'lmm'] },
  { id: 'dmax-lml', short: '2011–2016 Duramax LML', labels: ['2011–2016 Chevrolet Silverado / GMC Sierra 2500HD/3500HD 6.6L Duramax LML'], platforms: ['duramax'], models: GM_HD, generations: ['gmhd-2011-2016'], tags: [...GM_HD_TAGS, 'lml'] },
  { id: 'dmax-l5p-early', short: '2017–2019 Duramax L5P', labels: ['2017–2019 Chevrolet Silverado / GMC Sierra 2500HD/3500HD 6.6L Duramax L5P'], platforms: ['duramax'], models: GM_HD, generations: ['gmhd-2017-2019'], tags: [...GM_HD_TAGS, 'l5p'] },
  { id: 'dmax-l5p', short: '2020–present Duramax L5P', labels: ['2020–present Chevrolet Silverado / GMC Sierra 2500HD/3500HD 6.6L Duramax L5P'], platforms: ['duramax'], models: GM_HD, generations: ['gmhd-2020'], tags: [...GM_HD_TAGS, 'l5p'] },
  { id: 'dmax-30', short: '2020–present 3.0L Duramax 1500', labels: ['2020–present Chevrolet Silverado 1500 / GMC Sierra 1500 3.0L Duramax I6'], platforms: ['duramax'], models: GM_LD, generations: ['gm1500-2019'], tags: ['chevrolet', 'gmc', 'silverado-1500', 'sierra-1500', 'duramax', '3.0l'] },

  { id: 'psd-73', short: '2001–2003 7.3L Power Stroke', labels: ['2001–2003 Ford F-250/F-350 7.3L Power Stroke'], platforms: ['powerstroke'], models: FORD_SD, generations: ['sd-2001-2003'], tags: [...FORD_SD_TAGS, '7.3l'] },
  { id: 'psd-60', short: '2003.5–2007 6.0L Power Stroke', labels: ['2003.5–2007 Ford F-250/F-350 6.0L Power Stroke'], platforms: ['powerstroke'], models: FORD_SD, generations: ['sd-2004-2007'], tags: [...FORD_SD_TAGS, '6.0l'] },
  { id: 'psd-64', short: '2008–2010 6.4L Power Stroke', labels: ['2008–2010 Ford F-250/F-350/F-450 6.4L Power Stroke'], platforms: ['powerstroke'], models: FORD_SD_450, generations: ['sd-2008-2010'], tags: [...FORD_SD_TAGS, 'f-450', '6.4l'] },
  { id: 'psd-67-2011', short: '2011–2016 6.7L Power Stroke', labels: ['2011–2016 Ford F-250/F-350/F-450 6.7L Power Stroke'], platforms: ['powerstroke'], models: FORD_SD_450, generations: ['sd-2011-2016'], tags: [...FORD_SD_TAGS, 'f-450', '6.7l'] },
  { id: 'psd-67-2017', short: '2017–2019 6.7L Power Stroke', labels: ['2017–2019 Ford F-250/F-350/F-450 6.7L Power Stroke'], platforms: ['powerstroke'], models: FORD_SD_450, generations: ['sd-2017-2019'], tags: [...FORD_SD_TAGS, 'f-450', '6.7l'] },
  { id: 'psd-67-2020', short: '2020–2022 6.7L Power Stroke', labels: ['2020–2022 Ford F-250/F-350/F-450 6.7L Power Stroke'], platforms: ['powerstroke'], models: FORD_SD_450, generations: ['sd-2020-2022'], tags: [...FORD_SD_TAGS, 'f-450', '6.7l'] },
  { id: 'psd-67-2023', short: '2023–present 6.7L Power Stroke', labels: ['2023–present Ford F-250/F-350/F-450 6.7L Power Stroke, standard and High Output'], platforms: ['powerstroke'], models: FORD_SD_450, generations: ['sd-2023'], tags: [...FORD_SD_TAGS, 'f-450', '6.7l'] },
  { id: 'psd-30', short: '2018–2021 F-150 3.0L Power Stroke', labels: ['2018–2021 Ford F-150 3.0L Power Stroke V6'], platforms: ['powerstroke'], models: ['ford-f-150'], generations: ['f150-2015-2020', 'f150-2021'], tags: ['ford', 'f-150', 'powerstroke', '3.0l'] },

  { id: 'cum-24v', short: '2001–2002 5.9L Cummins 24V', labels: ['2001–2002 Dodge Ram 2500/3500 5.9L Cummins 24-valve'], platforms: ['cummins'], models: RAM_HD, generations: ['ramhd-2001-2002'], tags: [...RAM_HD_TAGS, '5.9l', '24v'] },
  { id: 'cum-cr59', short: '2003–2007 5.9L Cummins', labels: ['2003–2007 Dodge Ram 2500/3500 5.9L Cummins common rail'], platforms: ['cummins'], models: RAM_HD, generations: ['ramhd-2003-2007'], tags: [...RAM_HD_TAGS, '5.9l', 'common-rail'] },
  { id: 'cum-67a', short: '2007.5–2012 6.7L Cummins', labels: ['2007.5–2012 Dodge Ram / Ram 2500/3500/4500 6.7L Cummins'], platforms: ['cummins'], models: RAM_HD_4500, generations: ['ramhd-2008-2009', 'ramhd-2010-2012', 'ram4500-2008-2009', 'ram4500-2010-2012'], tags: [...RAM_HD_TAGS, '4500', '6.7l'] },
  { id: 'cum-67b', short: '2013–2018 6.7L Cummins', labels: ['2013–2018 Ram 2500/3500/4500 6.7L Cummins, standard and High Output'], platforms: ['cummins'], models: RAM_HD_4500, generations: ['ramhd-2013-2018', 'ram4500-2013-2018'], tags: [...RAM_HD_TAGS, '4500', '6.7l'] },
  { id: 'cum-67c', short: '2019–present 6.7L Cummins', labels: ['2019–present Ram 2500/3500/4500 6.7L Cummins, standard and High Output'], platforms: ['cummins'], models: RAM_HD_4500, generations: ['ramhd-2019', 'ram4500-2019'], tags: [...RAM_HD_TAGS, '4500', '6.7l'] },
  { id: 'ram-ecodiesel', short: '2014–2023 Ram 1500 EcoDiesel', labels: ['2014–2023 Ram 1500 3.0L EcoDiesel V6'], platforms: [], models: ['ram-1500'], generations: ['ram1500-2009-2018', 'ram1500-2019'], tags: ['ram', '1500', 'ecodiesel', '3.0l'] },

  { id: 'gas-f150-54', short: '2004–2010 F-150 5.4L', labels: ['2004–2010 Ford F-150 5.4L Triton V8'], platforms: [], models: ['ford-f-150'], generations: ['f150-2004-2008', 'f150-2009-2014'], tags: ['ford', 'f-150', 'triton', '5.4l', 'gas'] },
  { id: 'gas-f150-coyote', short: '2011–present F-150 5.0L', labels: ['2011–present Ford F-150 5.0L Coyote V8'], platforms: [], models: ['ford-f-150'], generations: ['f150-2009-2014', 'f150-2015-2020', 'f150-2021'], tags: ['ford', 'f-150', 'coyote', '5.0l', 'gas'] },
  { id: 'gas-f150-eb35', short: '2011–present F-150 3.5L EcoBoost', labels: ['2011–present Ford F-150 3.5L EcoBoost V6'], platforms: [], models: ['ford-f-150'], generations: ['f150-2009-2014', 'f150-2015-2020', 'f150-2021'], tags: ['ford', 'f-150', 'ecoboost', '3.5l', 'gas'] },
  { id: 'gas-sd-62', short: '2011–2022 Super Duty 6.2L', labels: ['2011–2022 Ford F-250/F-350 6.2L Boss V8'], platforms: [], models: FORD_SD, generations: ['sd-2011-2016', 'sd-2017-2019', 'sd-2020-2022'], tags: ['ford', 'f-250', 'f-350', 'super-duty', '6.2l', 'gas'] },
  { id: 'gas-sd-73', short: '2020–present Super Duty 7.3L', labels: ['2020–present Ford F-250/F-350 7.3L gas V8'], platforms: [], models: FORD_SD, generations: ['sd-2020-2022', 'sd-2023'], tags: ['ford', 'f-250', 'f-350', 'super-duty', '7.3l', 'gas'] },
  { id: 'gas-gmhd-60', short: '2001–2019 Silverado/Sierra HD 6.0L', labels: ['2001–2019 Chevrolet Silverado / GMC Sierra 2500HD/3500HD 6.0L Vortec V8'], platforms: [], models: GM_HD, generations: ['gmhd-2001-2004', 'gmhd-2005', 'gmhd-2006-2007', 'gmhd-2008-2010', 'gmhd-2011-2016', 'gmhd-2017-2019'], tags: ['chevrolet', 'gmc', '2500hd', '3500hd', 'vortec', '6.0l', 'gas'] },
  { id: 'gas-gmhd-l8t', short: '2020–present Silverado/Sierra HD 6.6L L8T', labels: ['2020–present Chevrolet Silverado / GMC Sierra 2500HD/3500HD 6.6L L8T gas V8'], platforms: [], models: GM_HD, generations: ['gmhd-2020'], tags: ['chevrolet', 'gmc', '2500hd', '3500hd', 'l8t', '6.6l', 'gas'] },
  { id: 'gas-gm1500-53', short: '2014–present Silverado/Sierra 1500 5.3L', labels: ['2014–present Chevrolet Silverado 1500 / GMC Sierra 1500 5.3L V8'], platforms: [], models: GM_LD, generations: ['gm1500-2014-2018', 'gm1500-2019'], tags: ['chevrolet', 'gmc', 'silverado-1500', 'sierra-1500', '5.3l', 'gas'] },
  { id: 'gas-gm1500-62', short: '2014–present Silverado/Sierra 1500 6.2L', labels: ['2014–present Chevrolet Silverado 1500 / GMC Sierra 1500 6.2L V8'], platforms: [], models: GM_LD, generations: ['gm1500-2014-2018', 'gm1500-2019'], tags: ['chevrolet', 'gmc', 'silverado-1500', 'sierra-1500', '6.2l', 'gas'] },
  { id: 'gas-ram1500-57', short: '2003–present Ram 1500 5.7L Hemi', labels: ['2003–present Dodge Ram / Ram 1500 5.7L Hemi V8'], platforms: [], models: ['ram-1500'], generations: ['ram1500-2002-2008', 'ram1500-2009-2018', 'ram1500-2019'], tags: ['ram', 'dodge', '1500', 'hemi', '5.7l', 'gas'] },
  { id: 'gas-ramhd-64', short: '2014–present Ram 2500/3500 6.4L Hemi', labels: ['2014–present Ram 2500/3500 6.4L Hemi V8'], platforms: [], models: RAM_HD, generations: ['ramhd-2013-2018', 'ramhd-2019'], tags: ['ram', '2500', '3500', 'hemi', '6.4l', 'gas'] },
];

const unique = <T,>(values: readonly T[]): T[] => [...new Set(values)];

function toGroup(spec: GroupSpec): FitmentGroup {
  const fits = spec.models.flatMap((truckId) =>
    (findTruck(truckId)?.generations ?? [])
      .filter((generation) => spec.generations.includes(generation.id))
      .map((generation) => ({ truckId, generationId: generation.id })),
  );
  const collections = spec.models.flatMap((truckId) =>
    (findTruck(truckId)?.generations ?? [])
      .filter((generation) => spec.generations.includes(generation.id))
      .flatMap((generation) => (generation.generationCollection ? [generation.generationCollection] : [])),
  );
  return {
    id: spec.id,
    short: spec.short,
    labels: spec.labels,
    platforms: spec.platforms,
    // A gas part borrows nothing from the diesel collections its generation also holds.
    generationCollections: spec.platforms.length === 0 ? [] : unique(collections).filter((handle) => spec.platforms.some((platform) => handle.startsWith(`${platform}-`))),
    fits,
    tags: unique(spec.tags),
  };
}

export const FITMENT_GROUPS: readonly FitmentGroup[] = SPECS.map(toGroup);

const BY_ID = new Map(FITMENT_GROUPS.map((group) => [group.id, group]));

export function findGroup(id: string): FitmentGroup | null {
  return BY_ID.get(id) ?? null;
}
