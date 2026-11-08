import express from 'express';
import { z } from 'zod';
import { CartItems, CartError, priceCart } from '../services/cart.js';
import { SHIPPING_METHODS, FREE_SHIPPING_LIMIT_IN_ORE, shippingPriceInOre } from '../services/shippingPrices.js';
import { findServicePoints, getDeliveryEstimates } from '../integrations/shippingAdapter.js';

const router = express.Router();

const QuoteRequest = z.object({
  items: CartItems,
  postalCode: z.string().trim().regex(/^\d{3} ?\d{2}$/, 'Postnumret måste vara fem siffror'),
});

router.post('/quote', async (req, res) => {
  const parsed = QuoteRequest.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues.map((issue) => issue.message).join(', ') });
  }

  const postalCode = parsed.data.postalCode.replace(' ', '');

  let subtotalInOre;
  try {
    ({ subtotalInOre } = await priceCart(parsed.data.items));
  } catch (error) {
    if (error instanceof CartError) {
      return res.status(error.status).json({ error: error.message });
    }
    throw error;
  }

  const [servicePointsResult, estimatesResult] = await Promise.allSettled([
    findServicePoints(postalCode),
    getDeliveryEstimates(postalCode),
  ]);

  if (servicePointsResult.status === 'rejected') {
    console.error('[PostNord] Ombud:', servicePointsResult.reason.cause ?? servicePointsResult.reason.message);
  }
  if (estimatesResult.status === 'rejected') {
    console.error('[PostNord] Leveranstid:', estimatesResult.reason.cause ?? estimatesResult.reason.message);
  }

  const estimates = estimatesResult.status === 'fulfilled' ? estimatesResult.value : {};

  res.json({
    subtotal: subtotalInOre / 100,
    freeShippingLimit: FREE_SHIPPING_LIMIT_IN_ORE / 100,
    options: Object.entries(SHIPPING_METHODS).map(([method, { label }]) => ({
      method,
      label,
      price: shippingPriceInOre(method, subtotalInOre) / 100,
      estimatedDelivery: estimates[method] ?? null,
    })),
    servicePoints: servicePointsResult.status === 'fulfilled' ? servicePointsResult.value : null,
  });
});

export default router;