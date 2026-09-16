// RSS feed of essays (blog posts). Notes are not syndicated (backlog).
import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPublished } from '../lib/published.ts';
import { allTags } from '../lib/tags.ts';
import { BYLINE, PERSON, SITE_URL } from '../site.config.ts';

export async function GET(context: APIContext) {
  const posts = (await getPublished('blog')).sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
  return rss({
    title: `Essays by ${BYLINE.blog}`,
    description: `Essays by ${BYLINE.blog} (${PERSON.displayName}) on economics, data, markets and archery.`,
    site: context.site ?? SITE_URL,
    trailingSlash: false,
    items: posts.map((p) => ({
      title: p.data.title ?? p.id,
      pubDate: p.data.date,
      description: p.data.summary,
      link: `/blog/${p.id}`,
      author: BYLINE.blog,
      categories: allTags(p.data.tags, p.body ?? ''),
    })),
    customData: '<language>en</language>',
  });
}
