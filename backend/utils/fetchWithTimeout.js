export class ExternalServiceError extends Error {
  constructor(service, message, { status = 503, cause } = {}) {
    super(message);
    this.name = 'ExternalServiceError';
    this.service = service;
    this.status = status;
    this.cause = cause;
  }
}

export async function fetchWithTimeout(service, url, options = {}, timeoutMs = 8000) {
  let response;
  try {
    response = await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    if (err.name === 'TimeoutError') {
      throw new ExternalServiceError(service, `${service} svarade inte i tid. Försök igen om en stund.`, { cause: err });
    }
    throw new ExternalServiceError(service, `Kunde inte nå ${service}. Försök igen om en stund.`, { cause: err });
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error(`[${service}] HTTP ${response.status}:`, body.slice(0, 500));
    throw new ExternalServiceError(service, `${service} svarade med ett fel (${response.status}).`, {
      status: 502,
    });
  }

  return response;
}