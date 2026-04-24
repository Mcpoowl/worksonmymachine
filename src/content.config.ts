import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
	loader: glob({ base: './src/content/posts', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
		number: z.number(),
		title: z.string(),
		dek: z.string(),
		category: z.string(),
		kicker: z.enum(['Essay', 'Note', 'Field report', 'Rant']).default('Essay'),
		date: z.coerce.date(),
		readTime: z.number(),
		tags: z.array(z.string()),
		editorNote: z.string().optional(),
		draft: z.boolean().default(false),
	}),
});

const now = defineCollection({
	loader: glob({ base: './src/content/now', pattern: '**/*.{md,json}' }),
	schema: z.object({
		writing: z.string(),
		reading: z.string(),
		running: z.array(z.string()),
		broken: z.array(z.string()),
		listening: z.string(),
		coffee: z.string(),
		updatedAt: z.coerce.date(),
	}),
});

export const collections = { posts, now };
