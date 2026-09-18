import { dieselEngine, gasEngine, type TruckGeneration, type TruckModel } from './types';

const VORTEC_43 = gasEngine('gm-4-3-vortec', '4.3L Vortec V6');
const VORTEC_48 = gasEngine('gm-4-8-vortec', '4.8L Vortec V8');
const VORTEC_53 = gasEngine('gm-5-3-vortec', '5.3L Vortec V8');
const VORTEC_60 = gasEngine('gm-6-0-vortec', '6.0L Vortec V8');
const VORTEC_62 = gasEngine('gm-6-2-vortec', '6.2L Vortec V8');
const VORTEC_81 = gasEngine('gm-8-1-vortec', '8.1L Vortec V8');
const ECOTEC3_43 = gasEngine('gm-4-3-ecotec3', '4.3L EcoTec3 V6');
const ECOTEC3_53 = gasEngine('gm-5-3-ecotec3', '5.3L EcoTec3 V8');
const ECOTEC3_62 = gasEngine('gm-6-2-ecotec3', '6.2L EcoTec3 V8');
const TURBO_27 = gasEngine('gm-2-7-turbo', '2.7L Turbo I4');
const L8T_66 = gasEngine('gm-6-6-l8t', '6.6L L8T V8');
const LB7 = dieselEngine('gm-6-6-lb7', '6.6L Duramax LB7', 'duramax');
const LLY = dieselEngine('gm-6-6-lly', '6.6L Duramax LLY', 'duramax');
const LBZ = dieselEngine('gm-6-6-lbz', '6.6L Duramax LBZ', 'duramax');
const LMM = dieselEngine('gm-6-6-lmm', '6.6L Duramax LMM', 'duramax');
const LML = dieselEngine('gm-6-6-lml', '6.6L Duramax LML', 'duramax');
const L5P = dieselEngine('gm-6-6-l5p', '6.6L Duramax L5P', 'duramax');
const DURAMAX_30 = dieselEngine('gm-3-0-duramax', '3.0L Duramax I6 (2020–)', 'duramax');
/** The medium-duty 6.6L is the L5D, not the L5P the pickups use. */
const L5D = dieselEngine('gm-6-6-l5d', '6.6L Duramax L5D', 'duramax');

const GM_1500: readonly TruckGeneration[] = [
  { id: 'gm1500-2001-2006', label: '2001–2006', yearFrom: 2001, yearTo: 2006, generationCollection: null, engines: [VORTEC_43, VORTEC_48, VORTEC_53, VORTEC_60] },
  { id: 'gm1500-2007-2013', label: '2007–2013', yearFrom: 2007, yearTo: 2013, generationCollection: null, engines: [VORTEC_43, VORTEC_48, VORTEC_53, VORTEC_60, VORTEC_62] },
  { id: 'gm1500-2014-2018', label: '2014–2018', yearFrom: 2014, yearTo: 2018, generationCollection: null, engines: [ECOTEC3_43, ECOTEC3_53, ECOTEC3_62] },
  { id: 'gm1500-2019', label: '2019–present', yearFrom: 2019, yearTo: null, generationCollection: null, engines: [ECOTEC3_43, TURBO_27, ECOTEC3_53, ECOTEC3_62, DURAMAX_30] },
];

/**
 * 2007 sold both the classic-body LBZ and the new-body LMM, so the whole-year
 * bounds keep 2007 with the LBZ. GM badged the one-ton Silverado 3500 until the
 * 2007.5 truck, when it became the 3500HD.
 */
const GM_HD: readonly TruckGeneration[] = [
  { id: 'gmhd-2001-2004', label: '2001–2004', yearFrom: 2001, yearTo: 2004, generationCollection: 'duramax-2001-2004-lb7', engines: [LB7, VORTEC_60, VORTEC_81] },
  { id: 'gmhd-2005', label: '2004.5–2005', yearFrom: 2005, yearTo: 2005, generationCollection: 'duramax-2004-5-2005-lly', engines: [LLY, VORTEC_60, VORTEC_81] },
  { id: 'gmhd-2006-2007', label: '2006–2007', yearFrom: 2006, yearTo: 2007, generationCollection: 'duramax-2006-2007-lbz', engines: [LBZ, VORTEC_60] },
  { id: 'gmhd-2008-2010', label: '2007.5–2010', yearFrom: 2008, yearTo: 2010, generationCollection: 'duramax-2007-5-2010-lmm', engines: [LMM, VORTEC_60] },
  { id: 'gmhd-2011-2016', label: '2011–2016', yearFrom: 2011, yearTo: 2016, generationCollection: 'duramax-2011-2016-lml', engines: [LML, VORTEC_60] },
  { id: 'gmhd-2017-2019', label: '2017–2019', yearFrom: 2017, yearTo: 2019, generationCollection: 'duramax-2017-present-l5p', engines: [L5P, VORTEC_60] },
  { id: 'gmhd-2020', label: '2020–present', yearFrom: 2020, yearTo: null, generationCollection: 'duramax-2017-present-l5p', engines: [L5P, L8T_66] },
];

const CHEVY_MD: readonly TruckGeneration[] = [
  { id: 'gmmd-2019', label: '2019–present', yearFrom: 2019, yearTo: null, generationCollection: null, engines: [L5D] },
];

const GMC_MD: readonly TruckGeneration[] = [
  { id: 'gmmd-2023', label: '2023–present', yearFrom: 2023, yearTo: null, generationCollection: null, engines: [L5D] },
];

export const GM_TRUCKS: readonly TruckModel[] = [
  { id: 'chevrolet-silverado-1500', make: 'chevrolet', model: 'Silverado 1500', class: '1500', generations: GM_1500 },
  { id: 'chevrolet-silverado-2500hd', make: 'chevrolet', model: 'Silverado 2500HD', class: '2500', generations: GM_HD },
  { id: 'chevrolet-silverado-3500hd', make: 'chevrolet', model: 'Silverado 3500HD', class: '3500', generations: GM_HD },
  { id: 'chevrolet-silverado-4500hd', make: 'chevrolet', model: 'Silverado 4500HD', class: '4500', generations: CHEVY_MD },
  { id: 'gmc-sierra-1500', make: 'gmc', model: 'Sierra 1500', class: '1500', generations: GM_1500 },
  { id: 'gmc-sierra-2500hd', make: 'gmc', model: 'Sierra 2500HD', class: '2500', generations: GM_HD },
  { id: 'gmc-sierra-3500hd', make: 'gmc', model: 'Sierra 3500HD', class: '3500', generations: GM_HD },
  { id: 'gmc-sierra-4500hd', make: 'gmc', model: 'Sierra 4500HD', class: '4500', generations: GMC_MD },
];
