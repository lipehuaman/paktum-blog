import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
import { storyblok } from '@storyblok/astro';

const env = loadEnv('', process.cwd(), 'STORYBLOK');

export default defineConfig({
  integrations: [
    storyblok({
      accessToken: env.STORYBLOK_TOKEN,
      apiOptions: {
        region: 'eu',
      },
      components: {
        blogPost: 'storyblok/BlogPost',
      },
    }),
  ],
});
