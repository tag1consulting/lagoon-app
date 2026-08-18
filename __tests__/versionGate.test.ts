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

  describe('document-variant gates', () => {
    // The 2.8 floor instance must never be sent a post-2.8 field: Lagoon
    // rejects the whole query, so a false positive here blanks an entire screen.
    const documentFeatures = [
      'deploymentDetails',
      'taskDetails',
      'serviceDetails',
      'taskArgumentMetadata',
    ] as const;

    it.each(documentFeatures)('is closed for %s on Lagoon 2.8.0', (feature) => {
      expect(hasFeature({ lagoonVersion: '2.8.0' }, feature)).toBe(false);
    });

    it.each(documentFeatures)('is closed for %s when the version is unknown', (feature) => {
      expect(hasFeature({}, feature)).toBe(false);
    });

    it.each(documentFeatures)('is open for %s on 2.18.0 and later', (feature) => {
      expect(hasFeature({ lagoonVersion: '2.18.0' }, feature)).toBe(true);
      expect(hasFeature({ lagoonVersion: '2.33.0' }, feature)).toBe(true);
    });

    it('stays closed just below the threshold', () => {
      expect(hasFeature({ lagoonVersion: '2.17.9' }, 'deploymentDetails')).toBe(false);
    });
  });

  it('gates fields measured as newer than the shared 2.18 threshold', () => {
    expect(hasFeature({ lagoonVersion: '2.18.0' }, 'deploymentBuildType')).toBe(false);
    expect(hasFeature({ lagoonVersion: '2.30.0' }, 'deploymentBuildType')).toBe(true);
    expect(hasFeature({ lagoonVersion: '2.30.0' }, 'serviceReplicas')).toBe(false);
    expect(hasFeature({ lagoonVersion: '2.33.0' }, 'serviceReplicas')).toBe(true);
  });
});
