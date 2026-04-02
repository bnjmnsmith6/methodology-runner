/**
 * Offline caching service with TTL enforcement.
 * Manages preview and full track caching within licensing constraints.
 */

/**
 * In-memory cache store. In production this would use filesystem + database.
 * Key: `${trackId}:${cacheType}`, Value: CacheEntry
 * @type {Map<string, Object>}
 */
const cacheStore = new Map();

/**
 * Default cache TTL in seconds (24 hours - adjust per licensing agreements).
 */
const DEFAULT_CACHE_TTL_SECONDS = 24 * 60 * 60;

/**
 * Maximum cache size in entries (prevents unbounded growth).
 */
const MAX_CACHE_ENTRIES = 500;

/**
 * @typedef {Object} CacheEntry
 * @property {string} trackId
 * @property {'preview'|'full'} cacheType
 * @property {string|null} localPath - Local filesystem path for cached audio
 * @property {Buffer|null} data - In-memory cached data (for small previews)
 * @property {number} sizeBytes
 * @property {Date} expiresAt
 * @property {Date} cachedAt
 */

/**
 * Stores a track in cache with a TTL.
 * @param {string} trackId
 * @param {'preview'|'full'} cacheType
 * @param {Object} payload - { data, localPath, sizeBytes }
 * @param {number} [ttlSeconds] - Time-to-live in seconds
 * @returns {CacheEntry}
 */
function cacheTrack(trackId, cacheType, payload, ttlSeconds = DEFAULT_CACHE_TTL_SECONDS) {
  if (!trackId) throw new Error('trackId is required');
  if (!['preview', 'full'].includes(cacheType)) {
    throw new Error('cacheType must be "preview" or "full"');
  }

  // Enforce cache size limit — evict oldest entry if at capacity
  if (cacheStore.size >= MAX_CACHE_ENTRIES) {
    evictOldest();
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
  const key = cacheKey(trackId, cacheType);

  const entry = {
    trackId,
    cacheType,
    localPath: payload.localPath || null,
    data: payload.data || null,
    sizeBytes: payload.sizeBytes || (payload.data ? payload.data.length : 0),
    expiresAt,
    cachedAt: now,
  };

  cacheStore.set(key, entry);
  return entry;
}

/**
 * Retrieves a cached track if it exists and hasn't expired.
 * @param {string} trackId
 * @param {'preview'|'full'} cacheType
 * @returns {CacheEntry|null}
 */
function getCached(trackId, cacheType) {
  const key = cacheKey(trackId, cacheType);
  const entry = cacheStore.get(key);

  if (!entry) return null;

  if (new Date() >= entry.expiresAt) {
    cacheStore.delete(key);
    return null;
  }

  return entry;
}

/**
 * Removes all expired cache entries.
 * @returns {number} Number of entries removed
 */
function cleanExpired() {
  const now = new Date();
  let removed = 0;

  for (const [key, entry] of cacheStore.entries()) {
    if (now >= entry.expiresAt) {
      cacheStore.delete(key);
      removed++;
    }
  }

  return removed;
}

/**
 * Removes a specific track from cache.
 * @param {string} trackId
 * @param {'preview'|'full'|null} [cacheType] - If null, removes both types
 * @returns {number} Number of entries removed
 */
function evictTrack(trackId, cacheType = null) {
  let removed = 0;

  if (cacheType) {
    const key = cacheKey(trackId, cacheType);
    if (cacheStore.delete(key)) removed++;
  } else {
    for (const type of ['preview', 'full']) {
      const key = cacheKey(trackId, type);
      if (cacheStore.delete(key)) removed++;
    }
  }

  return removed;
}

/**
 * Returns cache statistics.
 * @returns {{ totalEntries: number, totalSizeBytes: number, expiredCount: number }}
 */
function getCacheStats() {
  const now = new Date();
  let totalSizeBytes = 0;
  let expiredCount = 0;

  for (const entry of cacheStore.values()) {
    totalSizeBytes += entry.sizeBytes || 0;
    if (now > entry.expiresAt) expiredCount++;
  }

  return {
    totalEntries: cacheStore.size,
    totalSizeBytes,
    expiredCount,
  };
}

/**
 * Checks if a track is available offline (cached and not expired).
 * @param {string} trackId
 * @param {'preview'|'full'} cacheType
 * @returns {boolean}
 */
function isAvailableOffline(trackId, cacheType) {
  return getCached(trackId, cacheType) !== null;
}

/**
 * Evicts the oldest cache entry to make room for new entries.
 */
function evictOldest() {
  let oldestKey = null;
  let oldestTime = Infinity;

  for (const [key, entry] of cacheStore.entries()) {
    const cachedMs = entry.cachedAt.getTime();
    if (cachedMs < oldestTime) {
      oldestTime = cachedMs;
      oldestKey = key;
    }
  }

  if (oldestKey) cacheStore.delete(oldestKey);
}

/**
 * Builds cache key from track ID and cache type.
 * @param {string} trackId
 * @param {string} cacheType
 * @returns {string}
 */
function cacheKey(trackId, cacheType) {
  return `${trackId}:${cacheType}`;
}

/**
 * Clears all cache entries (for testing purposes only).
 */
function _clearAll() {
  cacheStore.clear();
}

module.exports = {
  cacheTrack,
  getCached,
  cleanExpired,
  evictTrack,
  getCacheStats,
  isAvailableOffline,
  DEFAULT_CACHE_TTL_SECONDS,
  MAX_CACHE_ENTRIES,
  _clearAll,
};
