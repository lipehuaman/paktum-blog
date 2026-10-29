import { useStoryblokApi } from '@storyblok/astro';

// Categorias del blog: salen del datasource "Blog Kategorien" de Storyblok
// (name = aleman, dimension "en" = ingles). El espanol no tiene dimension, va aqui.
const ES_LABELS = {
  partnerschaften: 'Alianzas',
  ratgeber: 'Guías',
  'produkt-news': 'Novedades del producto',
};

let entries;

export async function getBlogCategories(lang = 'de') {
  if (!entries) {
    const storyblokApi = useStoryblokApi();
    const { data } = await storyblokApi.get('cdn/datasource_entries', {
      datasource: 'blog-kategorien',
      dimension: 'en',
      per_page: 100,
    });
    entries = data.datasource_entries || [];
  }
  return entries.map((e) => ({
    value: e.value,
    label: lang === 'en' ? e.dimension_value || e.name : lang === 'es' ? ES_LABELS[e.value] || e.name : e.name,
  }));
}

// Solo las categorias que tienen al menos un post (para no mostrar filtros vacios)
export function usedCategories(categories, values) {
  return categories.filter((c) => values.includes(c.value));
}

export function categoryLabel(categories, value) {
  return categories.find((c) => c.value === value)?.label || value;
}
