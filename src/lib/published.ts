// The ONLY place pages may read collections from. A unit test greps for other getCollection( calls.
import { getCollection, type CollectionEntry } from 'astro:content';

export const SHOW_DRAFTS = import.meta.env.DEV && process.env.SHOW_DRAFTS === '1';
export type ContentCollection = 'notes' | 'blog' | 'achievements';
export type Entry<C extends ContentCollection> = CollectionEntry<C>;

export async function getPublished<C extends ContentCollection>(collection: C): Promise<Entry<C>[]> {
  const all = await getCollection(collection);
  return all.filter((e) => e.data.publish === true || SHOW_DRAFTS) as Entry<C>[];
}
export const isDraft = (e: { data: { publish: boolean } }) => e.data.publish !== true;

export async function getProfile(): Promise<CollectionEntry<'profile'>> {
  const [p] = await getCollection('profile');
  if (!p) throw new Error('content/profile.md is missing. Create it from the template.');
  return p;
}

export const byDateDesc = <T extends { data: { date?: Date; updated?: Date } }>(a: T, b: T) =>
  (b.data.updated ?? b.data.date ?? new Date(0)).getTime() - (a.data.updated ?? a.data.date ?? new Date(0)).getTime();
