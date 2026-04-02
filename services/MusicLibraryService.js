/**
 * Main music library service.
 * Orchestrates track CRUD, search, licensing, and caching.
 */

const { createTrack, isLicenseValid, isCacheValid, VALID_MOODS } = require('../models/Track');
const LicenseManager = require('./LicenseManager');
const CacheManager = require('./CacheManager');
const musicProvider = require('../api/musicProvider');

/**
 * In-memory track database. In production, replace with DB queries.
 * @type {Map<string, import('../models/Track').Track>}
 */
const trackDb = new Map();

/**
 * Searches tracks by mood and optional filters.
 * Core interface for the mood detection system.
 *
 * @param {string} mood - Required mood tag
 * @param {number} energy - Energy level 1-5
 * @param {Object} [options]
 * @param {string} [options.genre]
 * @param {number} [options.limit]
 * @param {boolean} [options.offlineOnly] - Return only cached tracks
 * @returns {import('../models/Track').Track[]}
 */
function searchByMood(mood, energy, options = {}) {
  if (!mood) throw new Error('mood is required');
  if (energy !== undefined && (energy < 1 || energy > 5)) {
    throw new Error('energy must be between 1 and 5');
  }

  const { genre, limit = 20, offlineOnly = false } = options;

  let results = [];

  for (const track of trackDb.values()) {
    if (track.tags.mood !== mood) continue;
    if (genre && track.tags.genre !== genre) continue;
    if (energy !== undefined && Math.abs(track.tags.energy - energy) > 1) continue;
    if (!isLicenseValid(track)) continue;
    if (offlineOnly && !CacheManager.isAvailableOffline(track.id, 'preview')) continue;

    results.push(track);
  }

  // Sort by energy proximity, then by title for deterministic ordering
  if (energy !== undefined) {
    results.sort((a, b) => {
      const aDiff = Math.abs(a.tags.energy - energy);
      const bDiff = Math.abs(b.tags.energy - energy);
      if (aDiff !== bDiff) return aDiff - bDiff;
      return a.title.localeCompare(b.title);
    });
  }

  return results.slice(0, limit);
}

/**
 * Retrieves a single track by ID.
 * @param {string} id
 * @returns {import('../models/Track').Track|null}
 */
function getTrack(id) {
  return trackDb.get(id) || null;
}

/**
 * Adds or updates a track in the library.
 * @param {Object} trackData - Raw track data (will be validated via createTrack)
 * @returns {import('../models/Track').Track}
 */
function upsertTrack(trackData) {
  const track = createTrack({
    ...trackData,
    updatedAt: new Date(),
  });
  trackDb.set(track.id, track);
  return track;
}

/**
 * Removes a track from the library.
 * @param {string} id
 * @returns {boolean} True if the track was found and deleted
 */
function deleteTrack(id) {
  CacheManager.evictTrack(id);
  return trackDb.delete(id);
}

/**
 * Refreshes the library from the given provider, seeding new tracks.
 * Will not overwrite manually curated tracks unless forced.
 *
 * @param {Object} [options]
 * @param {'spotify'|'local'} [options.provider]
 * @param {string[]} [options.moods] - Moods to fetch
 * @param {boolean} [options.force] - Overwrite existing tracks
 * @returns {Promise<{ added: number, skipped: number, errors: string[] }>}
 */
async function refreshLibrary(options = {}) {
  const {
    provider = 'local',
    moods = VALID_MOODS,
    force = false,
  } = options;

  let added = 0;
  let skipped = 0;
  const errors = [];

  for (const mood of moods) {
    try {
      const tracks = await musicProvider.fetchTracks({ mood, provider });

      for (const track of tracks) {
        if (!force && trackDb.has(track.id)) {
          skipped++;
          continue;
        }
        trackDb.set(track.id, track);
        added++;
      }
    } catch (err) {
      errors.push(`Failed to fetch tracks for mood "${mood}": ${err.message}`);
    }
  }

  return { added, skipped, errors };
}

/**
 * Initiates playback for a track, performing license check and usage logging.
 * Returns playback details including enforced preview limit.
 *
 * @param {string} trackId
 * @param {'preview'|'full'} playType
 * @param {Object} [options]
 * @param {string} [options.userSessionId]
 * @returns {{ url: string, maxDurationSeconds: number, wasCached: boolean }}
 */
function initiatePlayback(trackId, playType = 'preview', options = {}) {
  const track = getTrack(trackId);
  if (!track) throw new Error(`Track not found: ${trackId}`);

  const { allowed, reason } = LicenseManager.validateLicense(track, playType);
  if (!allowed) throw new Error(`Playback not allowed: ${reason}`);

  const maxDurationSeconds = playType === 'preview'
    ? LicenseManager.getMaxPreviewDuration(track)
    : (track.durationSeconds || Infinity);

  // Check cache first for offline mode
  const cacheType = playType === 'preview' ? 'preview' : 'full';
  const cached = CacheManager.getCached(trackId, cacheType);
  const wasCached = Boolean(cached);

  const url = playType === 'preview' ? track.previewUrl : track.fullUrl;
  if (!url && !cached?.localPath) {
    throw new Error(`No playback URL available for track: ${trackId}`);
  }

  // Log usage for royalty reporting
  LicenseManager.trackUsage(trackId, playType, 0, {
    wasCached,
    userSessionId: options.userSessionId,
    context: { mood: track.tags.mood, genre: track.tags.genre },
  });

  return {
    url: cached?.localPath || url,
    maxDurationSeconds,
    wasCached,
  };
}

/**
 * Caches a track's preview for offline use.
 * @param {string} trackId
 * @param {Buffer} audioData
 * @param {number} [ttlSeconds]
 * @returns {Object} Cache entry
 */
function cachePreview(trackId, audioData, ttlSeconds) {
  const track = getTrack(trackId);
  if (!track) throw new Error(`Track not found: ${trackId}`);

  const { allowed } = LicenseManager.validateLicense(track, 'preview');
  if (!allowed) throw new Error('Cannot cache: license invalid');

  return CacheManager.cacheTrack(trackId, 'preview', {
    data: audioData,
    sizeBytes: audioData.length,
  }, ttlSeconds);
}

/**
 * Returns library statistics.
 * @returns {{ totalTracks: number, byMood: Object, cacheStats: Object }}
 */
function getLibraryStats() {
  const byMood = {};

  for (const track of trackDb.values()) {
    byMood[track.tags.mood] = (byMood[track.tags.mood] || 0) + 1;
  }

  return {
    totalTracks: trackDb.size,
    byMood,
    cacheStats: CacheManager.getCacheStats(),
  };
}

/**
 * Clears the library (for testing purposes only).
 */
function _clearLibrary() {
  trackDb.clear();
  CacheManager._clearAll();
}

module.exports = {
  searchByMood,
  getTrack,
  upsertTrack,
  deleteTrack,
  refreshLibrary,
  initiatePlayback,
  cachePreview,
  getLibraryStats,
  _clearLibrary,
};
