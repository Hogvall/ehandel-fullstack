import { z } from 'zod';
import pool from '../db.js';

export const CartItems = z
  .array(
    z.object({
      productId: z.number('produkt-id saknas').int('ogiltigt produkt-id').positive('ogiltigt produkt-id'),
      quantity: z
        .number('antal saknas')
        .int('antal måste vara ett heltal')
        .min(1, 'antal måste vara minst 1')
        .max(99, 'högst 99 st per produkt'),
    })
  )
  .min(1, 'Varukorgen är tom')
  .max(50, 'För många produkter i varukorgen');

export class CartError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function priceCart(items) {
  const quantities = new Map();
  for (const item of items) {
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  }

  const [products] = await pool.query('SELECT id, name, price, stock FROM products WHERE id IN (?)', [
    [...quantities.keys()],
  ]);
  const productsById = new Map(products.map((product) => [product.id, product]));

  const lines = [];
  for (const [productId, quantity] of quantities) {
    const product = productsById.get(productId);

    if (!product) {
      throw new CartError(400, `En produkt i varukorgen finns inte längre (id ${productId})`);
    }

    if (product.stock < quantity) {
      throw new CartError(409, `Det finns bara ${product.stock} st kvar av ${product.name}`);
    }

    lines.push({
      productId,
      name: product.name,
      quantity,
      unitAmount: Math.round(Number(product.price) * 100),
    });
  }

  const subtotalInOre = lines.reduce((sum, line) => sum + line.unitAmount * line.quantity, 0);
  return { lines, subtotalInOre };
}