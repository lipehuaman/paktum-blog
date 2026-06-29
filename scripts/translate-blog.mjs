// scripts/translate-blog.mjs
// Traduce los posts del blog de alemán (base de Storyblok) a español con DeepL,
// y guarda el resultado en src/data/blog-es.json (que leen las rutas /blog/es).
//
// Uso:  npm run translate:blog
// Requiere en .env:  STORYBLOK_TOKEN=...  y  DEEPL_API_KEY=...
//
// Cuida tu cupo: cada texto se traduce UNA sola vez y se guarda en translation-cache.json.
// Al volver a correrlo solo traduce lo nuevo. Sube al repo blog-es.json y translation-cache.json.

import fs from 'node:fs';
import path from 'node:path';

const SB_TOKEN = process.env.STORYBLOK_TOKEN;
const DEEPL_KEY = process.env.DEEPL_API_KEY;

if (!SB_TOKEN) { console.error('Falta STORYBLOK_TOKEN. Corre con: npm run translate:blog (usa --env-file=.env)'); process.exit(1); }
if (!DEEPL_KEY) { console.error('Falta DEEPL_API_KEY en el .env'); process.exit(1); }

const CACHE_PATH = 'translation-cache.json';
const DATA_PATH = path.join('src', 'data', 'blog-es.json');
const DEEPL_HOST = DEEPL_KEY.trim().endsWith(':fx') ? 'api-free.deepl.com' : 'api.deepl.com';

const loadJSON = (p, fallback) => { try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return fallback; } };
const saveJSON = (p, obj) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(obj, null, 2)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- Storyblok: traer posts en alemán (idioma por defecto) ----
async function fetchStories() {
  const params = new URLSearchParams({
    starts_with: 'blog/',
    content_type: 'blogPost',
    version: 'published',
    per_page: '100',
    token: SB_TOKEN,
  });
  const res = await fetch(`https://api.storyblok.com/v2/cdn/stories?${params}`);
  if (!res.ok) throw new Error(`Storyblok ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.stories || [];
}

// ---- Recorrer richtext: recolectar y traducir solo los textos (sin tocar código ni estructura) ----
function collectStrings(node, out) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach((n) => collectStrings(n, out)); return; }
  if (node.type === 'code_block') return;
  if (node.type === 'text' && typeof node.text === 'string') {
    const hasCode = Array.isArray(node.marks) && node.marks.some((m) => m.type === 'code');
    if (!hasCode && node.text.trim()) out.push(node.text);
    return;
  }
  if (Array.isArray(node.content)) node.content.forEach((n) => collectStrings(n, out));
}

function translateNode(node, cache) {
  if (Array.isArray(node)) return node.map((n) => translateNode(n, cache));
  if (!node || typeof node !== 'object') return node;
  if (node.type === 'code_block') return node;
  if (node.type === 'text' && typeof node.text === 'string') {
    const hasCode = Array.isArray(node.marks) && node.marks.some((m) => m.type === 'code');
    if (!hasCode && node.text.trim() && cache[node.text]) return { ...node, text: cache[node.text] };
    return node;
  }
  const copy = { ...node };
  if (Array.isArray(node.content)) copy.content = node.content.map((n) => translateNode(n, cache));
  return copy;
}

// ---- DeepL: traducir un lote de textos (DE -> ES) ----
async function deeplBatch(texts) {
  const out = [];
  for (let i = 0; i < texts.length; i += 40) {
    const chunk = texts.slice(i, i + 40);
    const res = await fetch(`https://${DEEPL_HOST}/v2/translate`, {
      method: 'POST',
      headers: { Authorization: `DeepL-Auth-Key ${DEEPL_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: chunk, source_lang: 'DE', target_lang: 'ES', preserve_formatting: true }),
    });
    if (!res.ok) throw new Error(`DeepL ${res.status}: ${await res.text()}`);
    const data = await res.json();
    data.translations.forEach((t) => out.push(t.text));
    if (i + 40 < texts.length) await sleep(500); // amable con el rate limit del plan free
  }
  return out;
}

async function deeplUsage() {
  try {
    const res = await fetch(`https://${DEEPL_HOST}/v2/usage`, {
      headers: { Authorization: `DeepL-Auth-Key ${DEEPL_KEY}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// ---- Main ----
async function main() {
  console.log('Trayendo posts en aleman de Storyblok...');
  const stories = await fetchStories();
  console.log(`  ${stories.length} post(s) encontrados.`);

  // 1) Recolectar todos los textos unicos a traducir
  const all = new Set();
  for (const story of stories) {
    const c = story.content || {};
    [c.title, c.excerpt, c.category, c.meta_title, c.meta_description, c.cover?.alt]
      .forEach((s) => { if (typeof s === 'string' && s.trim()) all.add(s); });
    const bodyStrings = [];
    collectStrings(c.body, bodyStrings);
    bodyStrings.forEach((s) => all.add(s));
  }

  // 2) Traducir solo lo que no este en cache
  const cache = loadJSON(CACHE_PATH, {});
  const missing = [...all].filter((s) => !(s in cache));
  console.log(`Textos unicos: ${all.size}. Nuevos por traducir: ${missing.length}.`);
  if (missing.length) {
    const chars = missing.reduce((n, s) => n + [...s].length, 0);
    console.log(`Enviando ~${chars} caracteres a DeepL...`);
    const translated = await deeplBatch(missing);
    missing.forEach((s, i) => { cache[s] = translated[i]; });
    saveJSON(CACHE_PATH, cache);
    console.log('Cache actualizada.');
  } else {
    console.log('Nada nuevo: todo estaba en cache (0 caracteres usados).');
  }

  const tr = (s) => (typeof s === 'string' && cache[s] ? cache[s] : (s || ''));

  // 3) Construir blog-es.json (contenido listo para renderizar)
  const posts = stories.map((story) => {
    const c = story.content || {};
    return {
      slug: story.slug,
      title: tr(c.title),
      excerpt: tr(c.excerpt),
      category: tr(c.category),
      author: c.author || '',
      published_date: c.published_date || '',
      cover: c.cover?.filename ? { filename: c.cover.filename, alt: tr(c.cover.alt) || tr(c.title) } : null,
      meta_title: tr(c.meta_title),
      meta_description: tr(c.meta_description),
      available_en: !!c.available_en,
      body: translateNode(c.body, cache),
    };
  });
  saveJSON(DATA_PATH, { generatedAt: new Date().toISOString(), posts });
  console.log(`Listo: ${posts.length} post(s) escritos en ${DATA_PATH}`);

  const usage = await deeplUsage();
  if (usage) {
    const used = usage.character_count, limit = usage.character_limit;
    console.log(`DeepL: ${used.toLocaleString()} / ${limit.toLocaleString()} caracteres usados (quedan ${(limit - used).toLocaleString()}).`);
  }
  console.log('\nAhora sube los cambios: git add -A && commit && push.');
}

main().catch((e) => { console.error('\nERROR:', e.message); process.exit(1); });
