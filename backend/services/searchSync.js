import pool from '../db.js';
import { configureSearchIndex, indexProducts, removeProducts } from '../integrations/searchAdapter.js';

const PRODUCT_QUERY = `
  SELECT p.id, p.sku, p.name, p.description, p.price, p.stock, p.image_url,
    (SELECT c.name
       FROM product_categories pc
       JOIN categories c ON c.id = pc.category_id
      WHERE pc.product_id = p.id
      ORDER BY c.name
      LIMIT 1) AS category
  FROM products p
  WHERE p.sku IS NOT NULL`;

async function loadProducts(productIds) {
  if (productIds) {
    if (productIds.length === 0) return [];
    const [rows] = await pool.query(`${PRODUCT_QUERY} AND p.id IN (?)`, [productIds]);
    return rows;
  }

  const [rows] = await pool.query(PRODUCT_QUERY);
  return rows;
}

export async function rebuildSearchIndex() {
  try {
    await configureSearchIndex();
    const products = await loadProducts();
    await indexProducts(products);
    return true;
  } catch (error) {
    console.error('[Sökindex] Kunde inte bygga om sökindexet:', error.cause ?? error);
    return false;
  }
}

export async function syncProductsToSearch(productIds) {
  try {
    const products = await loadProducts(productIds);
    await indexProducts(products);
    return true;
  } catch (error) {
    console.error('[Sökindex] Kunde inte uppdatera produkter:', error.cause ?? error);
    return false;
  }
}

export async function removeProductsFromSearch(skus) {
  try {
    await removeProducts(skus);
    return true;
  } catch (error) {
    console.error('[Sökindex] Kunde inte ta bort produkter:', error.cause ?? error);
    return false;
  }
}