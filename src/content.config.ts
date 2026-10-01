import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { conferenceSchema } from './data/schema';

const conferences = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/data/conferences' }),
  schema: conferenceSchema,
});

export const collections = { conferences };
