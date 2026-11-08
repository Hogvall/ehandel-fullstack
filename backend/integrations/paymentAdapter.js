import Stripe from 'stripe';
import { z } from 'zod';
import { ExternalServiceError } from '../utils/fetchWithTimeout.js';

const SERVICE = 'Stripe';
const SESSION_LIFETIME_SECONDS = 31 * 60;

const CheckoutSession = z.object({
  id: z.string().startsWith('cs_'),
  client_reference_id: z.string().regex(/^\d+$/),
  payment_status: z.string(),
});

export class InvalidWebhookError extends Error {}

let stripeClient;

function getStripe() {
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
      timeout: 10000,
      maxNetworkRetries: 1,
    });
  }
  return stripeClient;
}

export async function createCheckoutSession({ orderId, customerEmail, lines, successUrl, cancelUrl }) {
  try {
    const session = await getStripe().checkout.sessions.create({
      mode: 'payment',
      client_reference_id: String(orderId),
      metadata: { orderId: String(orderId) },
      customer_email: customerEmail,
      line_items: lines.map((line) => ({
        quantity: line.quantity,
        price_data: {
          currency: 'sek',
          unit_amount: line.unitAmount,
          product_data: { name: line.name },
        },
      })),
      success_url: successUrl,
      cancel_url: cancelUrl,
      expires_at: Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS,
    });

    return { sessionId: session.id, url: session.url };
  } catch (err) {
    throw new ExternalServiceError(SERVICE, 'Betalningen är inte tillgänglig just nu. Försök igen om en stund.', {
      cause: err,
    });
  }
}

export function parseWebhookEvent(rawBody, signature) {
  let event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature ?? '', process.env.STRIPE_WEBHOOK_SECRET ?? '');
  } catch (err) {
    throw new InvalidWebhookError('Ogiltig signatur', { cause: err });
  }

  if (event.type !== 'checkout.session.completed' && event.type !== 'checkout.session.expired') {
    return { type: 'ignored', reason: `händelsen ${event.type} används inte` };
  }

  const session = CheckoutSession.safeParse(event.data.object);
  if (!session.success) {
    return { type: 'ignored', reason: 'sessionen saknar ett giltigt order-id' };
  }

  const { id, client_reference_id, payment_status } = session.data;
  const base = { orderId: Number(client_reference_id), sessionId: id };

  if (event.type === 'checkout.session.expired') {
    return { type: 'expired', ...base };
  }

  if (payment_status !== 'paid') {
    return { type: 'ignored', reason: `betalstatus är ${payment_status}` };
  }

  return { type: 'paid', ...base };
}