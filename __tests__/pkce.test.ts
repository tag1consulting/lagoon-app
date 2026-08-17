import { getDefaultRedirectUri, redirectUriFor } from '@/auth/pkce';

describe('getDefaultRedirectUri', () => {
  it('falls back to the literal scheme when no app scheme is registered', () => {
    // makeRedirectUri throws outside a real app runtime; the fallback keeps
    // every module that imports pkce.ts loadable.
    expect(getDefaultRedirectUri()).toBe('lagoonmobile://auth');
  });
});

describe('redirectUriFor', () => {
  it('uses the default when no override is set', () => {
    expect(redirectUriFor({})).toBe(getDefaultRedirectUri());
    expect(redirectUriFor({ redirectUri: undefined })).toBe('lagoonmobile://auth');
  });

  it('treats a blank override as unset', () => {
    expect(redirectUriFor({ redirectUri: '   ' })).toBe(getDefaultRedirectUri());
  });

  it('uses and trims an override', () => {
    expect(redirectUriFor({ redirectUri: '  io.tag1.lagoonmobile://oauth  ' })).toBe(
      'io.tag1.lagoonmobile://oauth',
    );
  });
});
