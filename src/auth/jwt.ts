const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Decode base64url to bytes without `atob`, which neither React Native nor
 * Expo polyfills (TypeScript's DOM lib makes it *look* available at compile
 * time, but it throws on Hermes).
 */
function base64UrlToBytes(input: string): Uint8Array {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/').replace(/[\s=]/g, '');
  const bytes = new Uint8Array(Math.floor((normalized.length * 3) / 4));

  let byteIndex = 0;
  let buffer = 0;
  let bitsCollected = 0;

  for (let i = 0; i < normalized.length; i++) {
    const value = BASE64_ALPHABET.indexOf(normalized[i]);
    if (value === -1) throw new Error('Invalid base64 character');
    buffer = (buffer << 6) | value;
    bitsCollected += 6;
    if (bitsCollected >= 8) {
      bitsCollected -= 8;
      bytes[byteIndex++] = (buffer >> bitsCollected) & 0xff;
    }
  }

  return bytes;
}

/** Decode a JWT payload without verification — used only to read expiry/identity client-side. */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    // TextDecoder is installed by Expo's winter runtime on native, so UTF-8
    // claims (names, emails) survive the round trip.
    const json = new TextDecoder().decode(base64UrlToBytes(parts[1]));
    const payload: unknown = JSON.parse(json);
    // A JWT payload must be a JSON object — arrays and scalars are malformed.
    return payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : null;
  } catch (error) {
    console.warn('[auth] could not decode JWT payload', error);
    return null;
  }
}

/** Expiry (ms since epoch) of a JWT, or null if unreadable. */
export function jwtExpiryMs(token: string): number | null {
  const payload = decodeJwtPayload(token);
  const exp = payload?.exp;
  return typeof exp === 'number' ? exp * 1000 : null;
}
