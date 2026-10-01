// Schema for one conference edition: src/data/conferences/<slug>.yaml.
// Shared by the Astro content collection, the validator script and the issue bot.
import { z } from 'astro/zod';
import { parseDate, parseTime } from '../lib/aoe';
import { FIELDS } from './fields';

// Astro's YAML parser turns bare dates into Date objects; normalise them back.
const dateString = z.preprocess(
  (v) => (v instanceof Date && !isNaN(v.getTime()) ? v.toISOString().slice(0, 10) : v),
  z.string().refine((s) => parseDate(s) !== null, { message: 'must be a real date written as YYYY-MM-DD' }),
);

const timeString = z
  .string({ invalid_type_error: 'must be a quoted time like "23:59"' })
  .refine((s) => parseTime(s) !== null, { message: 'must be a time written as HH:MM, e.g. "23:59"' });

export const deadlineSchema = z
  .object({
    track: z.string().trim().min(1, 'track is required, e.g. "Full papers"').max(60),
    date: dateString,
    time: timeString.optional(),
  })
  .strict();

export const conferenceSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3)
      .max(80)
      .regex(/\b(19|20)\d{2}\b/, 'name must include the edition year, e.g. "NeurIPS 2027"'),
    field: z.enum(FIELDS, {
      errorMap: () => ({ message: `field must be one of: ${FIELDS.join(', ')}` }),
    }),
    url: z
      .string()
      .url('url must be a full link to the official call for papers')
      .refine((u) => u.startsWith('https://'), 'url must start with https://'),
    location: z.string().trim().max(80).optional(),
    deadlines: z.array(deadlineSchema).min(1, 'add at least one deadline').max(10),
  })
  .strict();

export type Conference = z.infer<typeof conferenceSchema>;
export type Deadline = z.infer<typeof deadlineSchema>;

/** "NeurIPS 2027" → "neurips-2027". The data file must be named <slug>.yaml. */
export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
