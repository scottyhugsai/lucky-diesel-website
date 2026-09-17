/* Charleston seasonal calendar: when each play runs and its starter campaign. */

export interface SeasonalTemplate {
  key: string;
  name: string;
  /** 1-12, inclusive window shown on the calendar. */
  months: number[];
  window: string;
  pitch: string;
  channel: 'email' | 'sms';
  subject: string;
  body: string;
  /** Settings toggle that controls the automated version, if any. */
  toggle: string | null;
}

export const SEASONAL_TEMPLATES: readonly SeasonalTemplate[] = [
  {
    key: 'towing_season',
    name: 'Towing season prep',
    months: [3, 4],
    window: 'Mar 1 – Apr 15',
    pitch: 'Boats and campers come out. Sell the towing inspection.',
    channel: 'email',
    subject: 'Towing season check for your {{vehicle}}',
    body: 'Hey {{first_name}},\n\nBoat and camper season is close. Our towing inspection covers trans temps, cooling, brakes and hitch.\n\nBook a bay: {{link}}\n\n— Lucky Diesel',
    toggle: 'towing_season',
  },
  {
    key: 'hurricane_prep',
    name: 'Hurricane prep',
    months: [5, 6],
    window: 'May 20 – Jun 15',
    pitch: 'Evacuation-ready truck check before storm season.',
    channel: 'sms',
    subject: '',
    body: 'Hurricane season starts soon, {{first_name}}. Get an evacuation-ready truck check: fuel system, cooling, tow setup. Book: {{link}}',
    toggle: 'hurricane_prep',
  },
  {
    key: 'dyno_day',
    name: 'Dyno day invite',
    months: [9, 10],
    window: 'Pick a Saturday',
    pitch: 'Fill the dyno schedule and meet local owners.',
    channel: 'email',
    subject: 'Dyno day at Lucky Diesel: bring the {{vehicle}}',
    body: 'Hey {{first_name}},\n\nWe are running dyno pulls on Saturday. See real numbers for your truck and talk builds with our techs. Results vary by truck.\n\nSave a slot: {{link}}\n\n— Lucky Diesel',
    toggle: null,
  },
  {
    key: 'winter_diesel',
    name: 'Winter diesel prep',
    months: [10, 11],
    window: 'Oct 15 – Nov 30',
    pitch: 'Cold starts, batteries, glow plugs and anti-gel before trips north.',
    channel: 'email',
    subject: 'Cold-start check before winter trips',
    body: 'Hey {{first_name}},\n\nHeading north this winter? We check batteries, glow plugs or grid heater, fuel filters and anti-gel.\n\nBook a bay: {{link}}\n\n— Lucky Diesel',
    toggle: 'winter_diesel',
  },
];

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export function seasonalTemplate(key: string): SeasonalTemplate | null {
  return SEASONAL_TEMPLATES.find((t) => t.key === key) ?? null;
}
