import { useStoryblokApi } from '@storyblok/astro';
import esData from '../../data/blog-es.json';

export const prerender = true;
const SITE = 'https://www.paktum.ch';
const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

export async function GET() {
  const api = useStoryblokApi();
  const { data } = await api.get('cdn/stories', {
    version: 'published',
    starts_with: 'blog/',
    content_type: 'blogPost',
    language: 'en',
    per_page: 100,
  });
  const stories = data.stories || [];
  const esSlugs = new Set((esData.posts || []).map((p) => p.slug));
  const urls = [];

  const add = (loc, alts, lastmod) => {
    const links = alts.map((a) => `    <xhtml:link rel="alternate" hreflang="${a.lang}" href="${esc(a.href)}"/>`).join('\n');
    const de = alts.find((a) => a.lang === 'de');
    urls.push(
      `  <url>\n    <loc>${esc(loc)}</loc>\n${links}\n` +
      (de ? `    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(de.href)}"/>\n` : '') +
      (lastmod ? `    <lastmod>${String(lastmod).slice(0,10)}</lastmod>\n` : '') +
      `  </url>`
    );
  };

  const idx = [
    { lang: 'de', href: `${SITE}/blog` },
    { lang: 'en', href: `${SITE}/blog/en` },
    { lang: 'es', href: `${SITE}/blog/es` },
  ];
  idx.forEach((a) => add(a.href, idx, null));

  for (const s of stories) {
    const alts = [{ lang: 'de', href: `${SITE}/blog/${s.slug}` }];
    if (s.content?.available_en) alts.push({ lang: 'en', href: `${SITE}/blog/en/${s.slug}` });
    if (esSlugs.has(s.slug)) alts.push({ lang: 'es', href: `${SITE}/blog/es/${s.slug}` });
    const lastmod = s.published_at || s.updated_at || null;
    alts.forEach((a) => add(a.href, alts, lastmod));
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
}
