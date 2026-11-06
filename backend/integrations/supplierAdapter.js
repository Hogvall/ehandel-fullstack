import { parse } from 'csv-parse/sync';
import { XMLParser } from 'fast-xml-parser';
import { SyntaxValidator } from 'fast-xml-validator';
import { fetchWithTimeout, ExternalServiceError } from '../utils/fetchWithTimeout.js';

const SERVICE = 'Leverantörens API';
const TIMEOUT_MS = 10000;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  isArray: (name) => name === 'produkt' || name === 'variant',
});

function parseDecimal(value) {
  const text = String(value ?? '').replace(/\s/g, '').replace(',', '.');
  return text === '' ? NaN : Number(text);
}

function parseStock(value) {
  const text = String(value ?? '').trim();
  return text === '' ? 0 : Number(text);
}

function parseCsvCatalog(buffer) {
  const text = new TextDecoder('windows-1252').decode(buffer);

  let rows;
  try {
    rows = parse(text, {
      columns: true,
      delimiter: ';',
      skip_empty_lines: true,
      trim: true,
    });
  } catch (err) {
    throw new ExternalServiceError(SERVICE, 'Leverantören skickade en ogiltig CSV-fil.', { status: 502, cause: err });
  }

  return rows.map((row) => ({
    sku: row.artNr,
    ean: row.ean,
    name: row.benamning,
    category: row.kategori,
    price: parseDecimal(row.pris),
    stock: parseStock(row.lagersaldo),
    variants: row.varianter ? row.varianter.split('|') : [],
  }));
}

function parseXmlCatalog(buffer) {
  const text = new TextDecoder('utf-8').decode(buffer);

  try {
    SyntaxValidator.validate(text);
  } catch (err) {
    throw new ExternalServiceError(SERVICE, 'Leverantören skickade en ogiltig XML-fil.', { status: 502, cause: err });
  }

  const doc = xmlParser.parse(text);
  const products = doc.katalog?.produkt ?? [];

  return products.map((product) => ({
    sku: product['@_artNr'],
    ean: product.ean,
    name: product.benamning,
    category: product.kategori,
    price: parseDecimal(product.pris?.['#text'] ?? product.pris),
    stock: parseStock(product.lagersaldo),
    variants: product.varianter?.variant ?? [],
  }));
}

export async function getSupplierCatalog(format) {
  const bransch = encodeURIComponent(process.env.SUPPLIER_BRANSCH ?? 'klader');
  const url = `${process.env.SUPPLIER_API_URL}/export/products.${format}?bransch=${bransch}`;

  const response = await fetchWithTimeout(
    SERVICE,
    url,
    { headers: { 'X-Api-Key': process.env.SUPPLIER_API_KEY ?? '' } },
    TIMEOUT_MS
  );

  const buffer = Buffer.from(await response.arrayBuffer());

  return format === 'csv' ? parseCsvCatalog(buffer) : parseXmlCatalog(buffer);
}