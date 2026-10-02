import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://aoeconverter.com',
  // Cloudflare Pages serves /x/ and redirects /x to it, so canonical URLs end in a slash.
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [
    sitemap({
      // /d/ is a client-rendered shell for arbitrary deadlines; it isn't meant to be indexed.
      filter: (page) => !page.includes('/d/') && !page.endsWith('/404/'),
    }),
  ],
});
