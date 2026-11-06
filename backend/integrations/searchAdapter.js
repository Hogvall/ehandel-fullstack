import { algoliasearch } from 'algoliasearch';
import { z } from 'zod';
import { ExternalServiceError } from '../utils/fetchWithTimeout.js';

const SERVICE = 'Algolia';
const TIMEOUTS = { connect: 2000, read: 5000, write: 10000 };

const SORT_SUFFIX = {
  relevance: '',
  price_asc: '_price_asc',
  price_desc: '_price_desc',
};

const AlgoliaHit = z.object({
  objectID: z.string(),
  id: z.number().int(),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  price: z.number(),
  stock: z.number().int(),
  image_url: z.string().nullable(),
});

const AlgoliaResponse = z.object({
  hits: z.array(z.unknown()),
  nbHits: z.number().int(),
});

function indexName(sort = 'relevance') {
  return `${process.env.ALGOLIA_INDEX_NAME ?? 'products'}${SORT_SUFFIX[sort]}`;
}

function createClient(apiKey) {
  return algoliasearch(process.env.ALGOLIA_APP_ID ?? '', apiKey ?? '', { timeouts: TIMEOUTS });
}

async function callAlgolia(action, message) {
  try {
    return await action();
  } catch (err) {
    throw new ExternalServiceError(SERVICE, message, { cause: err });
  }
}

function toRecord(product) {
  return {
    objectID: product.sku,
    id: product.id,
    sku: product.sku,
    name: product.name,
    description: product.description ?? '',
    category: product.category ?? '',
    price: Number(product.price),
    stock: Number(product.stock),
    image_url: product.image_url ?? null,
  };
}

function fromHit(hit) {
  return {
    id: hit.id,
    sku: hit.objectID,
    name: hit.name,
    description: hit.description,
    category: hit.category,
    price: hit.price,
    stock: hit.stock,
    image_url: hit.image_url,
  };
}

export async function configureSearchIndex() {
  const client = createClient(process.env.ALGOLIA_ADMIN_KEY);
  const primary = indexName('relevance');

  await callAlgolia(async () => {
    const replicasTask = await client.setSettings({
      indexName: primary,
      indexSettings: { replicas: [indexName('price_asc'), indexName('price_desc')] },
    });
    await client.waitForTask({ indexName: primary, taskID: replicasTask.taskID });

    const settingsTask = await client.setSettings({
      indexName: primary,
      indexSettings: {
        searchableAttributes: ['name', 'category', 'sku', 'description'],
        attributesForFaceting: ['category'],
      },
      forwardToReplicas: true,
    });
    await client.waitForTask({ indexName: primary, taskID: settingsTask.taskID });

    for (const [sort, direction] of [['price_asc', 'asc'], ['price_desc', 'desc']]) {
      const replica = indexName(sort);
      const rankingTask = await client.setSettings({
        indexName: replica,
        indexSettings: {
          ranking: [`${direction}(price)`, 'typo', 'words', 'proximity', 'attribute', 'exact', 'custom'],
        },
      });
      await client.waitForTask({ indexName: replica, taskID: rankingTask.taskID });
    }
  }, 'Kunde inte konfigurera sökindexet.');
}

export async function indexProducts(products) {
  if (products.length === 0) return 0;

  const client = createClient(process.env.ALGOLIA_ADMIN_KEY);
  await callAlgolia(
    () => client.saveObjects({ indexName: indexName(), objects: products.map(toRecord) }),
    'Kunde inte uppdatera sökindexet.'
  );
  return products.length;
}

export async function removeProducts(skus) {
  if (skus.length === 0) return 0;

  const client = createClient(process.env.ALGOLIA_ADMIN_KEY);
  await callAlgolia(
    () => client.deleteObjects({ indexName: indexName(), objectIDs: skus }),
    'Kunde inte ta bort produkter från sökindexet.'
  );
  return skus.length;
}

export async function searchProducts({ q, category, inStock, sort, page, pageSize }) {
  const client = createClient(process.env.ALGOLIA_SEARCH_KEY);

  const filters = [];
  if (category) filters.push(`category:"${category.replaceAll('"', '\\"')}"`);
  if (inStock) filters.push('stock > 0');

  const raw = await callAlgolia(
    () =>
      client.searchSingleIndex({
        indexName: indexName(sort),
        searchParams: {
          query: q,
          page: page - 1,
          hitsPerPage: pageSize,
          filters: filters.join(' AND '),
        },
      }),
    'Sökningen är inte tillgänglig just nu. Försök igen om en stund.'
  );

  const response = AlgoliaResponse.safeParse(raw);
  if (!response.success) {
    throw new ExternalServiceError(SERVICE, 'Sökningen gav ett oväntat svar.', { status: 502 });
  }

  const products = [];
  for (const hit of response.data.hits) {
    const parsed = AlgoliaHit.safeParse(hit);
    if (parsed.success) {
      products.push(fromHit(parsed.data));
    } else {
      console.warn('[Algolia] Hoppar över ogiltig träff:', hit?.objectID);
    }
  }

  const total = response.data.nbHits;
  return {
    data: products,
    meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}