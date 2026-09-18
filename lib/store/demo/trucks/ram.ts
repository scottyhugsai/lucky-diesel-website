import { dieselEngine, gasEngine, type TruckGeneration, type TruckModel } from './types';

const MAGNUM_39 = gasEngine('ram-3-9-magnum', '3.9L Magnum V6');
const MAGNUM_52 = gasEngine('ram-5-2-magnum', '5.2L Magnum V8');
const MAGNUM_59 = gasEngine('ram-5-9-magnum', '5.9L Magnum V8');
const MAGNUM_V10 = gasEngine('ram-8-0-magnum-v10', '8.0L Magnum V10');
const MAGNUM_37 = gasEngine('ram-3-7-magnum', '3.7L Magnum V6');
const MAGNUM_47 = gasEngine('ram-4-7-magnum', '4.7L Magnum V8');
const PENTASTAR_36 = gasEngine('ram-3-6-pentastar', '3.6L Pentastar V6');
const HEMI_57 = gasEngine('ram-5-7-hemi', '5.7L Hemi V8');
const HEMI_64 = gasEngine('ram-6-4-hemi', '6.4L Hemi V8');
const HURRICANE_30 = gasEngine('ram-3-0-hurricane', '3.0L Hurricane twin-turbo I6 (2025–)');
/** VM Motori, not a Cummins — none of the shop's three platforms covers it. */
const ECODIESEL_30 = dieselEngine('ram-3-0-ecodiesel', '3.0L EcoDiesel V6', null);
const CUMMINS_59_24V = dieselEngine('ram-5-9-cummins-24v', '5.9L Cummins 24-valve I6', 'cummins');
const CUMMINS_59_CR = dieselEngine('ram-5-9-cummins-cr', '5.9L Cummins common-rail I6', 'cummins');
const CUMMINS_67 = dieselEngine('ram-6-7-cummins', '6.7L Cummins I6 (from 2007.5)', 'cummins');
const CUMMINS_67_HO = dieselEngine('ram-6-7-cummins-ho', '6.7L Cummins High Output I6', 'cummins');

const RAM_1500: readonly TruckGeneration[] = [
  { id: 'ram1500-2001', label: '2001', yearFrom: 2001, yearTo: 2001, generationCollection: null, engines: [MAGNUM_39, MAGNUM_52, MAGNUM_59] },
  { id: 'ram1500-2002-2008', label: '2002–2008', yearFrom: 2002, yearTo: 2008, generationCollection: null, engines: [MAGNUM_37, MAGNUM_47, HEMI_57] },
  { id: 'ram1500-2009-2018', label: '2009–2018', yearFrom: 2009, yearTo: 2018, generationCollection: null, engines: [MAGNUM_37, MAGNUM_47, PENTASTAR_36, HEMI_57, ECODIESEL_30] },
  { id: 'ram1500-2019', label: '2019–present', yearFrom: 2019, yearTo: null, generationCollection: null, engines: [PENTASTAR_36, HEMI_57, ECODIESEL_30, HURRICANE_30] },
];

/** The 6.7L arrived during the 2007 model year, so the 5.9L keeps the whole of 2007. */
const RAM_HD: readonly TruckGeneration[] = [
  { id: 'ramhd-2001-2002', label: '2001–2002', yearFrom: 2001, yearTo: 2002, generationCollection: 'cummins-1998-5-2002-5-9l-24v', engines: [CUMMINS_59_24V, MAGNUM_59, MAGNUM_V10] },
  { id: 'ramhd-2003-2007', label: '2003–2007', yearFrom: 2003, yearTo: 2007, generationCollection: 'cummins-2003-2007-5-9l-common-rail', engines: [CUMMINS_59_CR, HEMI_57] },
  { id: 'ramhd-2008-2009', label: '2007.5–2009', yearFrom: 2008, yearTo: 2009, generationCollection: 'cummins-2007-5-2012-6-7l', engines: [CUMMINS_67, HEMI_57] },
  { id: 'ramhd-2010-2012', label: '2010–2012', yearFrom: 2010, yearTo: 2012, generationCollection: 'cummins-2007-5-2012-6-7l', engines: [CUMMINS_67, HEMI_57] },
  { id: 'ramhd-2013-2018', label: '2013–2018', yearFrom: 2013, yearTo: 2018, generationCollection: 'cummins-2013-2018-6-7l', engines: [CUMMINS_67, HEMI_57, HEMI_64] },
  { id: 'ramhd-2019', label: '2019–present', yearFrom: 2019, yearTo: null, generationCollection: 'cummins-2019-present-6-7l', engines: [CUMMINS_67, HEMI_64] },
];

/** The High Output 6.7L is a 3500-and-up engine, paired with the Aisin box. */
const RAM_3500: readonly TruckGeneration[] = RAM_HD.map((generation) =>
  generation.yearFrom >= 2013 ? { ...generation, engines: [...generation.engines, CUMMINS_67_HO] } : generation,
);

/** The 4500/5500 chassis cab launched for 2008; the 6.4L Hemi came with the 2019 truck. */
const RAM_4500: readonly TruckGeneration[] = [
  { id: 'ram4500-2008-2009', label: '2008–2009', yearFrom: 2008, yearTo: 2009, generationCollection: 'cummins-2007-5-2012-6-7l', engines: [CUMMINS_67] },
  { id: 'ram4500-2010-2012', label: '2010–2012', yearFrom: 2010, yearTo: 2012, generationCollection: 'cummins-2007-5-2012-6-7l', engines: [CUMMINS_67] },
  { id: 'ram4500-2013-2018', label: '2013–2018', yearFrom: 2013, yearTo: 2018, generationCollection: 'cummins-2013-2018-6-7l', engines: [CUMMINS_67] },
  { id: 'ram4500-2019', label: '2019–present', yearFrom: 2019, yearTo: null, generationCollection: 'cummins-2019-present-6-7l', engines: [CUMMINS_67, HEMI_64] },
];

export const RAM_TRUCKS: readonly TruckModel[] = [
  { id: 'ram-1500', make: 'ram', model: '1500', class: '1500', generations: RAM_1500 },
  { id: 'ram-2500', make: 'ram', model: '2500', class: '2500', generations: RAM_HD },
  { id: 'ram-3500', make: 'ram', model: '3500', class: '3500', generations: RAM_3500 },
  { id: 'ram-4500', make: 'ram', model: '4500', class: '4500', generations: RAM_4500 },
];
