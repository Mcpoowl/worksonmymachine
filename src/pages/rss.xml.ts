import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { site } from '../site.config';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
	const posts = await getCollection('posts', ({ data }) => !data.draft);
	const sorted = posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

	return rss({
		title: site.title,
		description: site.description,
		site: context.site ?? site.url,
		items: sorted.map((post) => ({
			title: post.data.title,
			description: post.data.dek,
			pubDate: post.data.date,
			link: `/posts/${post.id}/`,
		})),
	});
}
