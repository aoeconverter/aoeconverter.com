// Timezones that get their own "AoE to …" landing page (/aoe-to-<slug>/).
// Chosen for where conference authors search from; `query` is the phrase people type.

export interface Zone {
  slug: string;
  query: string; // "AoE to IST"
  name: string; // "India Standard Time"
  short: string; // label for tables and links
  iana: string;
  places: string; // where it applies, for the intro sentence
}

export const ZONES: Zone[] = [
  { slug: 'utc', query: 'AoE to UTC', name: 'Coordinated Universal Time (UTC/GMT)', short: 'UTC', iana: 'UTC', places: 'UTC and GMT' },
  { slug: 'ist', query: 'AoE to IST', name: 'India Standard Time', short: 'India (IST)', iana: 'Asia/Kolkata', places: 'India and Sri Lanka' },
  { slug: 'china', query: 'AoE to Beijing time', name: 'China Standard Time', short: 'China (CST)', iana: 'Asia/Shanghai', places: 'mainland China, Hong Kong and Taiwan' },
  { slug: 'pst', query: 'AoE to PST', name: 'US Pacific Time (PST/PDT)', short: 'US Pacific', iana: 'America/Los_Angeles', places: 'California, Seattle and Vancouver' },
  { slug: 'est', query: 'AoE to EST', name: 'US Eastern Time (EST/EDT)', short: 'US Eastern', iana: 'America/New_York', places: 'New York, Boston, Toronto and Montreal' },
  { slug: 'cet', query: 'AoE to CET', name: 'Central European Time (CET/CEST)', short: 'Central Europe', iana: 'Europe/Paris', places: 'Paris, Berlin, Madrid, Rome and Amsterdam' },
  { slug: 'uk', query: 'AoE to UK time', name: 'UK time (GMT/BST)', short: 'UK', iana: 'Europe/London', places: 'the UK and Ireland' },
  { slug: 'jst', query: 'AoE to JST', name: 'Japan Standard Time', short: 'Japan (JST)', iana: 'Asia/Tokyo', places: 'Japan' },
  { slug: 'kst', query: 'AoE to KST', name: 'Korea Standard Time', short: 'Korea (KST)', iana: 'Asia/Seoul', places: 'South Korea' },
  { slug: 'sgt', query: 'AoE to SGT', name: 'Singapore Time', short: 'Singapore', iana: 'Asia/Singapore', places: 'Singapore and Malaysia' },
  { slug: 'aest', query: 'AoE to AEST', name: 'Australian Eastern Time (AEST/AEDT)', short: 'Sydney', iana: 'Australia/Sydney', places: 'Sydney, Melbourne and Canberra' },
  { slug: 'brt', query: 'AoE to Brasília time', name: 'Brasília Time', short: 'Brazil (BRT)', iana: 'America/Sao_Paulo', places: 'São Paulo, Rio de Janeiro and Brasília' },
];

/** Zones shown on each conference page, in this order. */
export const CONFERENCE_ZONES = ['utc', 'pst', 'est', 'uk', 'cet', 'ist', 'china', 'jst', 'kst', 'aest'].map(
  (s) => ZONES.find((z) => z.slug === s)!,
);
