import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://aoeconverter.com',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
});
