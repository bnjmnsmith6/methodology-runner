/**
 * Integration tests for the music library and licensing system.
 * Tests all acceptance criteria from the constellation packet.
 */

const assert = require('assert');
const { createTrack, isLicenseValid, isCacheValid, MAX_PREVIEW_SECONDS } = require('../models/Track');
const LicenseManager = require('../services/LicenseManager');
const CacheManager = require('../services/CacheManager');
const MusicLibraryService = require('../services/MusicLibraryService');
const { getMockLibrary, fetchMockTracks } = require('../api/musicProvider');

// ─── Test Helpers ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
    failures.push({ name, error: err.message });
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
    failures.push({ name, error: err.message });
  }
}

function makeTrack(overrides = {}) {
  return createTrack({
    id: 'test:001',
    title: 'Test Track',
    artist: 'Test Artist',
    tags: { mood: 'happy', genre: 'pop', energy: 4 },
    previewUrl: 'https://example.com/preview.mp3',
    fullUrl: 'https://example.com/full.mp3',
    license: {
      status: 'licensed',
      provider: 'local',
      previewOnly: false,
      maxPreviewSeconds: 30,
    },
    ...overrides,
  });
}

// ─── Acceptance Test 1: Can search for "happy" mood tracks ─────────────────────

console.log('\n[1] Search by mood');

test('searchByMood returns happy tracks from mock library', async () => {
  MusicLibraryService._clearLibrary();
  const mockTracks = getMockLibrary();
  for (const t of mockTracks) MusicLibraryService.upsertTrack(t);

  const results = MusicLibraryService.searchByMood('happy', undefined);
  assert.ok(results.length > 0, 'Should return at least one happy track');
  results.forEach(t => assert.strictEqual(t.tags.mood, 'happy', 'All results should have mood=happy'));
});

test('searchByMood filters by energy proximity (±1)', () => {
  MusicLibraryService._clearLibrary();
  const mockTracks = getMockLibrary();
  for (const t of mockTracks) MusicLibraryService.upsertTrack(t);

  const results = MusicLibraryService.searchByMood('energetic', 5);
  results.forEach(t => {
    assert.ok(Math.abs(t.tags.energy - 5) <= 1, `Energy ${t.tags.energy} should be within 1 of target 5`);
  });
});

test('searchByMood excludes expired licenses', () => {
  MusicLibraryService._clearLibrary();
  const expiredTrack = makeTrack({
    id: 'test:expired',
    tags: { mood: 'happy', genre: 'pop', energy: 3 },
    license: {
      status: 'licensed',
      provider: 'local',
      expiresAt: new Date(Date.now() - 1000), // expired 1 second ago
    },
  });
  MusicLibraryService.upsertTrack(expiredTrack);

  const results = MusicLibraryService.searchByMood('happy', undefined);
  const found = results.find(t => t.id === 'test:expired');
  assert.strictEqual(found, undefined, 'Expired track should not appear in search results');
});

test('searchByMood with genre filter', () => {
  MusicLibraryService._clearLibrary();
  const mockTracks = getMockLibrary();
  for (const t of mockTracks) MusicLibraryService.upsertTrack(t);

  const results = MusicLibraryService.searchByMood('calm', undefined, { genre: 'ambient' });
  results.forEach(t => {
    assert.strictEqual(t.tags.mood, 'calm');
    assert.strictEqual(t.tags.genre, 'ambient');
  });
});

// ─── Acceptance Test 2: Preview playback stops at 30 seconds ──────────────────

console.log('\n[2] Preview duration enforcement');

test('MAX_PREVIEW_SECONDS is 30', () => {
  assert.strictEqual(MAX_PREVIEW_SECONDS, 30);
});

test('getMaxPreviewDuration never exceeds 30 seconds', () => {
  const track = makeTrack({ license: { status: 'licensed', provider: 'local', maxPreviewSeconds: 60 } });
  const max = LicenseManager.getMaxPreviewDuration(track);
  assert.ok(max <= 30, `Preview duration ${max}s should not exceed 30s`);
});

test('initiatePlayback returns maxDurationSeconds <= 30 for previews', () => {
  MusicLibraryService._clearLibrary();
  const track = makeTrack({ id: 'test:preview-limit' });
  MusicLibraryService.upsertTrack(track);

  const result = MusicLibraryService.initiatePlayback('test:preview-limit', 'preview');
  assert.ok(result.maxDurationSeconds <= 30, `maxDurationSeconds ${result.maxDurationSeconds} should be <= 30`);
});

test('trackUsage caps preview duration at 30 seconds', () => {
  LicenseManager._clearUsageLogs();
  const entry = LicenseManager.trackUsage('test:001', 'preview', 999);
  assert.ok(entry.durationPlayedSeconds <= 30, 'Usage log should cap preview at 30s');
});

// ─── Acceptance Test 3: Cached tracks expire and are removed ──────────────────

console.log('\n[3] Cache expiry');

test('getCached returns null for expired cache entries', () => {
  CacheManager._clearAll();
  CacheManager.cacheTrack('track:001', 'preview', { data: Buffer.from('audio'), sizeBytes: 5 }, 0); // TTL=0
  // Manually expire by setting past date
  const key = 'track:001:preview';
  // Since we can't directly manipulate internals, use TTL=1ms workaround via negative TTL
  CacheManager._clearAll();
  // Cache with TTL that's effectively expired (simulate with tiny TTL)
  CacheManager.cacheTrack('track:exp', 'preview', { sizeBytes: 5 }, 0);
  // TTL 0 means expires immediately — getCached should return null
  const result = CacheManager.getCached('track:exp', 'preview');
  // With TTL=0, entry expires at cachedAt + 0ms = cachedAt, which is < now
  assert.strictEqual(result, null, 'Cache entry with TTL=0 should be expired');
});

test('cleanExpired removes expired entries and returns count', () => {
  CacheManager._clearAll();
  CacheManager.cacheTrack('track:A', 'preview', { sizeBytes: 10 }, 3600); // 1 hour - valid
  CacheManager.cacheTrack('track:B', 'preview', { sizeBytes: 10 }, 0);    // Expired

  const removed = CacheManager.cleanExpired();
  assert.ok(removed >= 1, `Should remove at least 1 expired entry, got ${removed}`);

  const stillValid = CacheManager.getCached('track:A', 'preview');
  assert.ok(stillValid !== null, 'Valid cache entry should still be present after cleanup');
});

test('cache evicts oldest entry when at MAX_CACHE_ENTRIES', () => {
  CacheManager._clearAll();
  const { MAX_CACHE_ENTRIES } = require('../services/CacheManager');

  // Fill cache to capacity
  for (let i = 0; i < MAX_CACHE_ENTRIES; i++) {
    CacheManager.cacheTrack(`track:fill:${i}`, 'preview', { sizeBytes: 1 }, 3600);
  }

  const statsBefore = CacheManager.getCacheStats();
  assert.strictEqual(statsBefore.totalEntries, MAX_CACHE_ENTRIES);

  // Adding one more should evict the oldest
  CacheManager.cacheTrack('track:overflow', 'preview', { sizeBytes: 1 }, 3600);
  const statsAfter = CacheManager.getCacheStats();
  assert.strictEqual(statsAfter.totalEntries, MAX_CACHE_ENTRIES, 'Cache should not exceed max entries');
});

// ─── Acceptance Test 4: License validation blocks expired content ──────────────

console.log('\n[4] License validation');

test('validateLicense blocks expired tracks', () => {
  const expiredTrack = makeTrack({
    license: {
      status: 'licensed',
      provider: 'local',
      expiresAt: new Date(Date.now() - 60000), // expired 1 minute ago
    },
  });
  const { allowed, reason } = LicenseManager.validateLicense(expiredTrack, 'preview');
  assert.strictEqual(allowed, false);
  assert.ok(reason.toLowerCase().includes('expired'), `Reason should mention expiry: "${reason}"`);
});

test('validateLicense blocks "restricted" status tracks', () => {
  const restrictedTrack = makeTrack({ license: { status: 'restricted', provider: 'local' } });
  const { allowed } = LicenseManager.validateLicense(restrictedTrack, 'preview');
  assert.strictEqual(allowed, false);
});

test('validateLicense blocks full playback when previewOnly=true', () => {
  const previewOnlyTrack = makeTrack({
    license: { status: 'licensed', provider: 'local', previewOnly: true, maxPreviewSeconds: 30 },
  });
  const { allowed, reason } = LicenseManager.validateLicense(previewOnlyTrack, 'full');
  assert.strictEqual(allowed, false);
  assert.ok(reason.toLowerCase().includes('preview'), `Reason should mention preview: "${reason}"`);
});

test('validateLicense allows preview for previewOnly tracks', () => {
  const previewOnlyTrack = makeTrack({
    license: { status: 'licensed', provider: 'local', previewOnly: true, maxPreviewSeconds: 30 },
  });
  const { allowed } = LicenseManager.validateLicense(previewOnlyTrack, 'preview');
  assert.strictEqual(allowed, true);
});

test('initiatePlayback throws for expired license', () => {
  MusicLibraryService._clearLibrary();
  const expiredTrack = makeTrack({
    id: 'test:expired2',
    license: { status: 'expired', provider: 'local' },
  });
  MusicLibraryService.upsertTrack(expiredTrack);

  assert.throws(
    () => MusicLibraryService.initiatePlayback('test:expired2', 'preview'),
    /Playback not allowed/
  );
});

// ─── Acceptance Test 5: Usage tracking logs all plays correctly ───────────────

console.log('\n[5] Usage tracking');

test('trackUsage creates a log entry with correct fields', () => {
  LicenseManager._clearUsageLogs();
  const entry = LicenseManager.trackUsage('track:test', 'preview', 25, {
    wasCached: false,
    userSessionId: 'session-abc',
  });

  assert.strictEqual(entry.trackId, 'track:test');
  assert.strictEqual(entry.playType, 'preview');
  assert.strictEqual(entry.durationPlayedSeconds, 25);
  assert.strictEqual(entry.wasCached, false);
  assert.strictEqual(entry.userSessionId, 'session-abc');
  assert.ok(entry.playedAt instanceof Date);
});

test('trackUsage logs all preview and full play types', () => {
  LicenseManager._clearUsageLogs();
  LicenseManager.trackUsage('track:A', 'preview', 15);
  LicenseManager.trackUsage('track:B', 'full', 200);

  const logs = LicenseManager.getAllUsageLogs();
  assert.strictEqual(logs.length, 2);
  assert.ok(logs.some(l => l.playType === 'preview'));
  assert.ok(logs.some(l => l.playType === 'full'));
});

test('getUsageReport filters by trackId', () => {
  LicenseManager._clearUsageLogs();
  LicenseManager.trackUsage('track:X', 'preview', 10);
  LicenseManager.trackUsage('track:Y', 'full', 180);

  const report = LicenseManager.getUsageReport('track:X');
  assert.strictEqual(report.length, 1);
  assert.strictEqual(report[0].trackId, 'track:X');
});

test('initiatePlayback auto-logs usage', () => {
  MusicLibraryService._clearLibrary();
  LicenseManager._clearUsageLogs();

  const track = makeTrack({ id: 'test:log-test' });
  MusicLibraryService.upsertTrack(track);
  MusicLibraryService.initiatePlayback('test:log-test', 'preview', { userSessionId: 's1' });

  const logs = LicenseManager.getAllUsageLogs();
  assert.ok(logs.length >= 1, 'Should have at least one usage log after playback');
  assert.strictEqual(logs[logs.length - 1].trackId, 'test:log-test');
});

// ─── Acceptance Test 6: Offline mode serves cached content ────────────────────

console.log('\n[6] Offline / cached content');

test('isAvailableOffline returns true when cached', () => {
  CacheManager._clearAll();
  CacheManager.cacheTrack('track:offline', 'preview', { data: Buffer.from('audio'), sizeBytes: 5 }, 3600);
  assert.strictEqual(CacheManager.isAvailableOffline('track:offline', 'preview'), true);
});

test('isAvailableOffline returns false when not cached', () => {
  CacheManager._clearAll();
  assert.strictEqual(CacheManager.isAvailableOffline('track:not-cached', 'preview'), false);
});

test('searchByMood with offlineOnly returns only cached tracks', () => {
  MusicLibraryService._clearLibrary();
  CacheManager._clearAll();

  const t1 = makeTrack({ id: 'test:c1', tags: { mood: 'happy', genre: 'pop', energy: 3 } });
  const t2 = makeTrack({ id: 'test:c2', tags: { mood: 'happy', genre: 'pop', energy: 3 } });
  MusicLibraryService.upsertTrack(t1);
  MusicLibraryService.upsertTrack(t2);

  // Only cache t1
  CacheManager.cacheTrack('test:c1', 'preview', { sizeBytes: 10 }, 3600);

  const results = MusicLibraryService.searchByMood('happy', undefined, { offlineOnly: true });
  assert.ok(results.every(t => CacheManager.isAvailableOffline(t.id, 'preview')),
    'All offline results should be cached');
  assert.ok(results.some(t => t.id === 'test:c1'), 'Cached track c1 should appear');
  assert.strictEqual(results.find(t => t.id === 'test:c2'), undefined, 'Uncached track c2 should not appear');
});

// ─── Additional: Track model validation ───────────────────────────────────────

console.log('\n[7] Track model');

test('createTrack throws for missing required fields', () => {
  assert.throws(() => createTrack({}), /id is required/);
  assert.throws(() => createTrack({ id: '1' }), /title is required/);
  assert.throws(() => createTrack({ id: '1', title: 'T' }), /artist is required/);
});

test('createTrack normalizes invalid mood to "calm"', () => {
  const t = createTrack({ id: '1', title: 'T', artist: 'A', tags: { mood: 'invalid-mood' } });
  assert.strictEqual(t.tags.mood, 'calm');
});

test('createTrack clamps energy to 1-5 range', () => {
  const t1 = createTrack({ id: '1', title: 'T', artist: 'A', tags: { energy: 10 } });
  assert.ok(t1.tags.energy >= 1 && t1.tags.energy <= 5);
});

test('checkExpiry returns true when license expires within threshold', () => {
  const licenseExpiringSoon = {
    expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
  };
  const nearExpiry = LicenseManager.checkExpiry(licenseExpiringSoon, 7);
  assert.strictEqual(nearExpiry, true, 'Should flag license expiring in 3 days when threshold is 7');
});

test('refreshLibrary seeds from mock provider', async () => {
  MusicLibraryService._clearLibrary();
  const result = await MusicLibraryService.refreshLibrary({ provider: 'local' });
  assert.ok(result.added > 0, `Should add tracks from mock library, got ${result.added}`);
  assert.strictEqual(result.errors.length, 0, `Should have no errors: ${result.errors.join(', ')}`);

  const stats = MusicLibraryService.getLibraryStats();
  assert.ok(stats.totalTracks > 0, 'Library should have tracks after refresh');
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log('\n─────────────────────────────────────');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(`  ✗ ${f.name}: ${f.error}`));
}
console.log('─────────────────────────────────────\n');

if (failed > 0) process.exit(1);
