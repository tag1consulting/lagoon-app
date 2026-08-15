import { hasFeature } from '@/api/versionGate';

describe('hasFeature', () => {
  it('gates by minimum version', () => {
    expect(hasFeature({ lagoonVersion: '2.33.1' }, 'cloneProject')).toBe(true);
    expect(hasFeature({ lagoonVersion: '2.32.0' }, 'cloneProject')).toBe(false);
    expect(hasFeature({ lagoonVersion: '2.31.0' }, 'idleState')).toBe(true);
    expect(hasFeature({ lagoonVersion: '2.27.0' }, 'modernSubscriptions')).toBe(true);
    expect(hasFeature({ lagoonVersion: '2.26.9' }, 'modernSubscriptions')).toBe(false);
  });

  it('tolerates v-prefixed and noisy version strings', () => {
    expect(hasFeature({ lagoonVersion: 'v2.33.0' }, 'cloneProject')).toBe(true);
  });

  it('fails closed on unknown versions', () => {
    expect(hasFeature({ lagoonVersion: undefined }, 'idleState')).toBe(false);
    expect(hasFeature({ lagoonVersion: 'unknown' }, 'idleState')).toBe(false);
  });
});
