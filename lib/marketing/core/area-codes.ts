/**
 * US area code → time zone(s), for recipient-local quiet hours. Pure data.
 * Area codes not listed are treated as the shop's time zone. Codes that span
 * two zones list both; a send must be inside the window in every one.
 */

const CHICAGO = 'America/Chicago';
const DENVER = 'America/Denver';
const PHOENIX = 'America/Phoenix';
const LOS_ANGELES = 'America/Los_Angeles';
const NEW_YORK = 'America/New_York';

const CENTRAL = [
  205, 251, 256, 334, 659, 938, // AL
  327, 479, 501, 870, // AR
  217, 224, 309, 312, 331, 447, 464, 618, 630, 708, 730, 773, 779, 815, 847, 861, 872, // IL
  319, 515, 563, 641, 712, // IA
  316, 913, // KS
  270, 364, // KY west
  225, 318, 337, 504, 985, // LA
  218, 320, 507, 612, 651, 763, 952, // MN
  228, 601, 662, 769, // MS
  314, 417, 557, 573, 636, 660, 816, 975, // MO
  402, 531, // NE
  405, 539, 572, 580, 918, // OK
  615, 629, 731, 901, // TN
  210, 214, 254, 281, 325, 346, 361, 409, 430, 469, 512, 682, 713, 726, 737, 806, 817, 830, 832, 903, 936, 940, 945, 956, 972, 979, // TX
  262, 274, 353, 414, 534, 608, 715, 920, // WI
  219, // IN northwest
];

const MOUNTAIN = [303, 719, 720, 970, 983, 406, 505, 575, 385, 435, 801, 307, 986, 915];
const ARIZONA = [480, 520, 602, 623, 928];
const PACIFIC = [
  209, 213, 279, 310, 323, 341, 350, 369, 408, 415, 424, 442, 510, 530, 559, 562, 619, 626, 628, 650, 657, 661, 669, 707, 714, 747, 760, 805, 818, 820, 831, 840, 858, 909, 916, 925, 949, 951, // CA
  702, 725, 775, // NV
  503, 971, // OR
  206, 253, 360, 425, 509, 564, // WA
];

const SPLIT: Record<number, string[]> = {
  850: [NEW_YORK, CHICAGO], 448: [NEW_YORK, CHICAGO], // FL panhandle
  812: [NEW_YORK, CHICAGO], 930: [NEW_YORK, CHICAGO], // IN south
  931: [CHICAGO, NEW_YORK], 906: [NEW_YORK, CHICAGO],
  605: [CHICAGO, DENVER], 308: [CHICAGO, DENVER], 701: [CHICAGO, DENVER], 620: [CHICAGO, DENVER], 785: [CHICAGO, DENVER], 432: [CHICAGO, DENVER],
  208: [DENVER, LOS_ANGELES], 541: [LOS_ANGELES, DENVER], 458: [LOS_ANGELES, DENVER],
  907: ['America/Anchorage'], 808: ['Pacific/Honolulu'],
};

export const AREA_CODE_ZONES: ReadonlyMap<number, readonly string[]> = new Map<number, readonly string[]>([
  ...CENTRAL.map((code): [number, string[]] => [code, [CHICAGO]]),
  ...MOUNTAIN.map((code): [number, string[]] => [code, [DENVER]]),
  ...ARIZONA.map((code): [number, string[]] => [code, [PHOENIX]]),
  ...PACIFIC.map((code): [number, string[]] => [code, [LOS_ANGELES]]),
  ...Object.entries(SPLIT).map(([code, zones]): [number, string[]] => [Number(code), zones]),
]);

/**
 * States whose telemarketing laws end marketing texts at 8pm local (not 9pm):
 * Florida (FTSA), Oklahoma (OTSA), Maryland (Stop the Spam Calls Act).
 */
export const EIGHT_PM_STATES: Readonly<Record<string, readonly number[]>> = {
  FL: [239, 305, 321, 324, 352, 386, 407, 448, 561, 645, 656, 689, 727, 728, 754, 772, 786, 813, 850, 863, 904, 941, 954],
  OK: [405, 539, 572, 580, 918],
  MD: [227, 240, 301, 410, 443, 667],
};
