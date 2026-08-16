import { decodeJwtPayload, jwtExpiryMs } from '@/auth/jwt';

function encodeSegment(value: object): string {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return globalThis
    .btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function makeJwt(payload: object): string {
  return `header.${encodeSegment(payload)}.signature`;
}

describe('decodeJwtPayload', () => {
  it('reads standard claims', () => {
    const payload = decodeJwtPayload(makeJwt({ exp: 1893456000, email: 'greg@example.com' }));
    expect(payload).toMatchObject({ exp: 1893456000, email: 'greg@example.com' });
  });

  it('decodes multi-byte UTF-8 claims', () => {
    const payload = decodeJwtPayload(makeJwt({ name: 'Grég Chaïx 日本語', exp: 1 }));
    expect(payload?.name).toBe('Grég Chaïx 日本語');
  });

  it('works without a global atob (Hermes has none)', () => {
    const original = globalThis.atob;
    // @ts-expect-error - deliberately removing the global for this test
    delete globalThis.atob;
    try {
      expect(decodeJwtPayload(makeJwt({ exp: 42 }))).toEqual({ exp: 42 });
    } finally {
      globalThis.atob = original;
    }
  });

  it('returns null for malformed input', () => {
    expect(decodeJwtPayload('not-a-jwt')).toBeNull();
    expect(decodeJwtPayload('a.b')).toBeNull();
    expect(decodeJwtPayload('header.!!!not-base64!!!.sig')).toBeNull();
    expect(decodeJwtPayload(`header.${encodeSegment([1, 2, 3])}.sig`)).toBeNull();
  });
});

describe('jwtExpiryMs', () => {
  it('converts exp seconds to milliseconds', () => {
    expect(jwtExpiryMs(makeJwt({ exp: 1893456000 }))).toBe(1893456000_000);
  });

  it('returns null when exp is absent or not numeric', () => {
    expect(jwtExpiryMs(makeJwt({ sub: 'abc' }))).toBeNull();
    expect(jwtExpiryMs(makeJwt({ exp: 'soon' }))).toBeNull();
    expect(jwtExpiryMs('garbage')).toBeNull();
  });
});
