import express from 'express';
import multer from 'multer';
import pool from '../db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { uploadProductImage, removeProductImage } from '../integrations/storageAdapter.js';
import { syncProductsToSearch } from '../services/searchSync.js';

const router = express.Router();

const MAX_SIZE_MB = 2;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

const SIGNATURES = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_BYTES, files: 1 },
});

function receiveImage(req, res, next) {
  upload.single('image')(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: `Bilden är för stor. Max ${MAX_SIZE_MB} MB.` });
    }
    if (err) {
      return res.status(400).json({ error: 'Filen kunde inte läsas. Skicka en bild i fältet "image".' });
    }
    next();
  });
}

function detectImageType(buffer) {
  for (const [mimeType, signature] of Object.entries(SIGNATURES)) {
    if (signature.every((byte, index) => buffer[index] === byte)) {
      return mimeType;
    }
  }
  return null;
}

router.post('/products/:id/image', authenticateToken, requireAdmin, receiveImage, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Ingen bild skickades.' });
  }

  const mimeType = detectImageType(req.file.buffer);
  if (!mimeType) {
    return res.status(400).json({ error: 'Filen måste vara en JPEG- eller PNG-bild.' });
  }

  const [rows] = await pool.query('SELECT id, image_path FROM products WHERE id = ?', [req.params.id]);
  if (rows.length === 0) {
    return res.status(404).json({ error: 'Produkten hittades inte' });
  }

  const productId = rows[0].id;
  const oldImagePath = rows[0].image_path;

  const image = await uploadProductImage(productId, { buffer: req.file.buffer, mimeType });

  try {
    await pool.query('UPDATE products SET image_path = ?, image_url = ? WHERE id = ?', [
      image.path,
      image.url,
      productId,
    ]);
  } catch (error) {
    await removeProductImage(image.path).catch((cleanupError) =>
      console.error('[Bilder] Kunde inte städa bort ny bild:', cleanupError.cause ?? cleanupError)
    );
    throw error;
  }

  if (oldImagePath) {
    await removeProductImage(oldImagePath).catch((error) =>
      console.error(`[Bilder] Gammal bild ${oldImagePath} kunde inte tas bort:`, error.cause ?? error)
    );
  }

  const searchIndexed = await syncProductsToSearch([productId]);

  res.status(201).json({ image_url: image.url, searchIndexed });
});

export default router;