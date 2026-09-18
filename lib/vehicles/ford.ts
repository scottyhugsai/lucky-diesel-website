import { dieselEngine, gasEngine, type TruckGeneration, type TruckModel } from './types';

const ESSEX_42 = gasEngine('ford-4-2-essex', '4.2L Essex V6');
const TRITON_46 = gasEngine('ford-4-6-triton', '4.6L Triton V8');
const TRITON_54 = gasEngine('ford-5-4-triton', '5.4L Triton V8');
const TRITON_54_3V = gasEngine('ford-5-4-triton-3v', '5.4L Triton 3V V8');
const TRITON_V10 = gasEngine('ford-6-8-triton-v10', '6.8L Triton V10');
const BOSS_62 = gasEngine('ford-6-2-boss', '6.2L Boss V8');
const GAS_73 = gasEngine('ford-7-3-v8', '7.3L V8');
const GAS_68 = gasEngine('ford-6-8-v8', '6.8L V8');
const TIVCT_37 = gasEngine('ford-3-7-tivct', '3.7L Ti-VCT V6');
const TIVCT_35 = gasEngine('ford-3-5-tivct', '3.5L Ti-VCT V6');
const TIVCT_33 = gasEngine('ford-3-3-tivct', '3.3L Ti-VCT V6');
const COYOTE_50 = gasEngine('ford-5-0-coyote', '5.0L Coyote V8');
const ECOBOOST_27 = gasEngine('ford-2-7-ecoboost', '2.7L EcoBoost V6');
const ECOBOOST_35 = gasEngine('ford-3-5-ecoboost', '3.5L EcoBoost V6');
const POWERBOOST = gasEngine('ford-3-5-powerboost', '3.5L PowerBoost full hybrid V6');
const PSD_73 = dieselEngine('ford-7-3-psd', '7.3L Power Stroke V8', 'powerstroke');
const PSD_60 = dieselEngine('ford-6-0-psd', '6.0L Power Stroke V8', 'powerstroke');
const PSD_64 = dieselEngine('ford-6-4-psd', '6.4L Power Stroke V8', 'powerstroke');
const PSD_67 = dieselEngine('ford-6-7-psd', '6.7L Power Stroke V8', 'powerstroke');
const PSD_67_HO = dieselEngine('ford-6-7-psd-ho', '6.7L High-Output Power Stroke V8', 'powerstroke');
const PSD_30 = dieselEngine('ford-3-0-psd', '3.0L Power Stroke V6', 'powerstroke');

const F150: readonly TruckGeneration[] = [
  { id: 'f150-2001-2003', label: '2001–2003', yearFrom: 2001, yearTo: 2003, generationCollection: null, engines: [ESSEX_42, TRITON_46, TRITON_54] },
  { id: 'f150-2004-2008', label: '2004–2008', yearFrom: 2004, yearTo: 2008, generationCollection: null, engines: [ESSEX_42, TRITON_46, TRITON_54_3V] },
  { id: 'f150-2009-2014', label: '2009–2014', yearFrom: 2009, yearTo: 2014, generationCollection: null, engines: [TRITON_46, TRITON_54_3V, TIVCT_37, COYOTE_50, ECOBOOST_35, BOSS_62] },
  { id: 'f150-2015-2020', label: '2015–2020', yearFrom: 2015, yearTo: 2020, generationCollection: null, engines: [TIVCT_35, TIVCT_33, ECOBOOST_27, ECOBOOST_35, COYOTE_50, PSD_30] },
  { id: 'f150-2021', label: '2021–present', yearFrom: 2021, yearTo: null, generationCollection: null, engines: [TIVCT_33, ECOBOOST_27, ECOBOOST_35, COYOTE_50, POWERBOOST, PSD_30] },
];

/**
 * Split by engine era rather than body, because that is how the shop's own
 * generation collections are cut. Ford sold both the 7.3L and the 6.0L during
 * 2003; the whole-year bounds put 2003 with the 7.3L.
 */
const SUPER_DUTY: readonly TruckGeneration[] = [
  { id: 'sd-2001-2003', label: '2001–2003', yearFrom: 2001, yearTo: 2003, generationCollection: 'powerstroke-1994-5-2003-7-3l', engines: [PSD_73, TRITON_54, TRITON_V10] },
  { id: 'sd-2004-2007', label: '2003.5–2007', yearFrom: 2004, yearTo: 2007, generationCollection: 'powerstroke-2003-2007-6-0l', engines: [PSD_60, TRITON_54, TRITON_V10] },
  { id: 'sd-2008-2010', label: '2008–2010', yearFrom: 2008, yearTo: 2010, generationCollection: 'powerstroke-2008-2010-6-4l', engines: [PSD_64, TRITON_54, TRITON_V10] },
  { id: 'sd-2011-2016', label: '2011–2016', yearFrom: 2011, yearTo: 2016, generationCollection: 'powerstroke-2011-2019-6-7l', engines: [PSD_67, BOSS_62] },
  { id: 'sd-2017-2019', label: '2017–2019', yearFrom: 2017, yearTo: 2019, generationCollection: 'powerstroke-2011-2019-6-7l', engines: [PSD_67, BOSS_62] },
  { id: 'sd-2020-2022', label: '2020–2022', yearFrom: 2020, yearTo: 2022, generationCollection: 'powerstroke-2020-2022-6-7l', engines: [PSD_67, GAS_73, BOSS_62] },
  { id: 'sd-2023', label: '2023–present', yearFrom: 2023, yearTo: null, generationCollection: 'powerstroke-2023-present-6-7l', engines: [PSD_67, PSD_67_HO, GAS_73, GAS_68] },
];

/** The F-450 pickup arrived for 2008 and has only ever been sold as a diesel. */
const F450: readonly TruckGeneration[] = SUPER_DUTY
  .filter((generation) => generation.yearFrom >= 2008)
  .map((generation) => ({ ...generation, engines: generation.engines.filter((engine) => engine.fuel === 'diesel') }));

export const FORD_TRUCKS: readonly TruckModel[] = [
  { id: 'ford-f-150', make: 'ford', model: 'F-150', class: '1500', generations: F150 },
  { id: 'ford-f-250', make: 'ford', model: 'F-250', class: '2500', generations: SUPER_DUTY },
  { id: 'ford-f-350', make: 'ford', model: 'F-350', class: '3500', generations: SUPER_DUTY },
  { id: 'ford-f-450', make: 'ford', model: 'F-450', class: '4500', generations: F450 },
];
