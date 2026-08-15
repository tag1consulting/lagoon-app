/** Decode a JWT payload without verification — used only to read expiry/identity client-side. */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = globalThis.atob(base64);
    // atob yields latin1; JWT payloads are UTF-8 — decode properly.
    const bytes = Uint8Array.from(json, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

/** Expiry (ms since epoch) of a JWT, or null if unreadable. */
export function jwtExpiryMs(token: string): number | null {
  const payload = decodeJwtPayload(token);
  const exp = payload?.exp;
  return typeof exp === 'number' ? exp * 1000 : null;
}
