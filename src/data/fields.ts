// Allowed values for a conference's `field`. Keep in sync with the dropdown in
// .github/ISSUE_TEMPLATE/add-conference.yml (a test checks this).
export const FIELDS = [
  'Artificial intelligence',
  'Computer vision',
  'Databases and data mining',
  'Human-computer interaction',
  'Machine learning',
  'Natural language processing',
  'Programming languages and software engineering',
  'Robotics',
  'Security and privacy',
  'Systems and networking',
  'Theory and algorithms',
  'Other',
] as const;

export type Field = (typeof FIELDS)[number];
