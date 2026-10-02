// Build-time access to the conference collection, flattened to one row per deadline.
import { getCollection } from 'astro:content';
import { deadlineEpoch } from './aoe';

export interface DeadlineRow {
  slug: string;
  name: string;
  field: string;
  url: string;
  location?: string;
  track: string;
  date: string;
  time?: string;
  epoch: number;
}

export async function deadlineRows(): Promise<DeadlineRow[]> {
  return (await getCollection('conferences'))
    .flatMap(({ id, data }) =>
      data.deadlines.map((d) => ({
        slug: id,
        name: data.name,
        field: data.field,
        url: data.url,
        location: data.location,
        track: d.track,
        date: d.date,
        time: d.time,
        epoch: deadlineEpoch(d.date, d.time)!,
      })),
    )
    .sort((a, b) => a.epoch - b.epoch);
}
