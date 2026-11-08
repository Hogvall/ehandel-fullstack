import { z } from 'zod';
import { fetchWithTimeout, ExternalServiceError } from '../utils/fetchWithTimeout.js';

const SERVICE = 'PostNord';
const TIMEOUT_MS = 5000;

export const POSTNORD_SERVICE_CODES = {
  home: '17',
  service_point: '19',
};

const ServicePointsResponse = z.object({
  servicePointInformationResponse: z.object({
    servicePoints: z
      .array(
        z.object({
          servicePointId: z.string().min(1),
          name: z.string().min(1),
          routeDistance: z.number().nullish(),
          visitingAddress: z.object({
            streetName: z.string(),
            streetNumber: z.string().nullish(),
            postalCode: z.string(),
            city: z.string(),
          }),
        })
      )
      .default([]),
  }),
});

const TransitTimeResponse = z.array(
  z.object({
    service: z.object({
      basicServiceCode: z.string(),
      additionalServices: z.unknown().optional(),
    }),
    estimatedTimeOfArrival: z
      .object({
        timeOfArrival: z.string().nullish(),
        dayRangeOfArrival: z
          .object({
            daysMinimum: z.number().int(),
            daysMaximum: z.number().int(),
          })
          .nullish(),
      })
      .nullish(),
    errorMessage: z.string().nullish(),
  })
);

function baseUrl() {
  return process.env.POSTNORD_API_URL ?? 'https://atapi2.postnord.com';
}

async function getJson(path, params) {
  const query = new URLSearchParams({ apikey: process.env.POSTNORD_API_KEY ?? '', ...params });
  const response = await fetchWithTimeout(SERVICE, `${baseUrl()}${path}?${query}`, {}, TIMEOUT_MS);

  try {
    return await response.json();
  } catch (err) {
    throw new ExternalServiceError(SERVICE, 'PostNord gav ett oväntat svar.', { status: 502, cause: err });
  }
}

function stockholmLocalTime(date = new Date()) {
  return date.toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm' }).replace(' ', 'T').slice(0, 16);
}

function hasNoAdditionalServices(entry) {
  const extra = entry.service.additionalServices;
  return extra == null || (Array.isArray(extra) && extra.length === 0);
}

export async function findServicePoints(postalCode) {
  const raw = await getJson('/rest/businesslocation/v5/servicepoints/nearest/byaddress', {
    returnType: 'json',
    countryCode: 'SE',
    postalCode,
    numberOfServicePoints: '5',
  });

  const parsed = ServicePointsResponse.safeParse(raw);
  if (!parsed.success) {
    throw new ExternalServiceError(SERVICE, 'PostNord gav ett oväntat svar om ombud.', { status: 502 });
  }

  return parsed.data.servicePointInformationResponse.servicePoints.map((point) => ({
    id: point.servicePointId,
    name: point.name,
    address: `${point.visitingAddress.streetName} ${point.visitingAddress.streetNumber ?? ''}`.trim(),
    postalCode: point.visitingAddress.postalCode,
    city: point.visitingAddress.city,
    distanceMeters: point.routeDistance ?? null,
  }));
}

export async function getDeliveryEstimates(destinationPostalCode) {
  const raw = await getJson('/rest/transport/v2/transittime/addresstoaddress', {
    startTime: stockholmLocalTime(),
    serviceCodes: Object.values(POSTNORD_SERVICE_CODES).join(','),
    originPostalCode: process.env.SHOP_POSTAL_CODE ?? '30250',
    originCountryCode: 'SE',
    destinationPostalCode,
    destinationCountryCode: 'SE',
  });

  const parsed = TransitTimeResponse.safeParse(raw);
  if (!parsed.success) {
    throw new ExternalServiceError(SERVICE, 'PostNord gav ett oväntat svar om leveranstid.', { status: 502 });
  }

  const estimates = {};
  for (const [method, code] of Object.entries(POSTNORD_SERVICE_CODES)) {
    const entry = parsed.data.find(
      (item) => item.service.basicServiceCode === code && hasNoAdditionalServices(item) && !item.errorMessage
    );
    const eta = entry?.estimatedTimeOfArrival;

    if (eta?.timeOfArrival) {
      estimates[method] = { date: eta.timeOfArrival.slice(0, 10) };
    } else if (eta?.dayRangeOfArrival) {
      estimates[method] = {
        daysMin: eta.dayRangeOfArrival.daysMinimum,
        daysMax: eta.dayRangeOfArrival.daysMaximum,
      };
    } else {
      estimates[method] = null;
    }
  }

  return estimates;
}