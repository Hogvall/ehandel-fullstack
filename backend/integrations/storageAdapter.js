import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { ExternalServiceError } from '../utils/fetchWithTimeout.js';

const SERVICE = 'Supabase Storage';
const TIMEOUT_MS = 10000;

const EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

const UploadResult = z.object({
  path: z.string().min(1),
});

let supabaseClient;

function getSupabase() {
  if (!supabaseClient) {
    supabaseClient = createClient(process.env.SUPABASE_URL ?? '', process.env.SUPABASE_SERVICE_KEY ?? '', {
      auth: { persistSession: false },
      global: {
        fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) }),
      },
    });
  }
  return supabaseClient;
}

function bucket() {
  return getSupabase().storage.from(process.env.SUPABASE_BUCKET ?? 'product-images');
}

export async function uploadProductImage(productId, { buffer, mimeType }) {
  const path = `products/${productId}/${randomUUID()}.${EXTENSIONS[mimeType]}`;

  let result;
  try {
    result = await bucket().upload(path, buffer, { contentType: mimeType, upsert: false });
  } catch (err) {
    throw new ExternalServiceError(SERVICE, 'Bildtjänsten svarar inte. Produkten behåller sin gamla bild.', {
      cause: err,
    });
  }

  if (result.error) {
    throw new ExternalServiceError(SERVICE, 'Bilden kunde inte laddas upp. Produkten behåller sin gamla bild.', {
      status: 502,
      cause: result.error,
    });
  }

  const uploaded = UploadResult.safeParse(result.data);
  if (!uploaded.success || uploaded.data.path !== path) {
    throw new ExternalServiceError(SERVICE, 'Bildtjänsten gav ett oväntat svar.', { status: 502 });
  }

  const { data } = bucket().getPublicUrl(path);
  return { path, url: data.publicUrl };
}

export async function removeProductImage(path) {
  let result;
  try {
    result = await bucket().remove([path]);
  } catch (err) {
    throw new ExternalServiceError(SERVICE, 'Bildtjänsten svarar inte.', { cause: err });
  }

  if (result.error) {
    throw new ExternalServiceError(SERVICE, 'Den gamla bilden kunde inte tas bort.', {
      status: 502,
      cause: result.error,
    });
  }
}