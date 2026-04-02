/**
 * Core music track data model with licensing and tagging support.
 */

/**
 * @typedef {Object} TagSet
 * @property {string} mood - Emotional mood (e.g. 'happy', 'sad', 'energetic', 'calm', 'angry', 'romantic')
 * @property {string} genre - Music genre (e.g. 'pop', 'rock', 'classical', 'jazz', 'electronic')
 * @property {number} energy - Energy level from 1 (low) to 5 (high)
 */

/**
 * @typedef {Object} LicenseInfo
 * @property {string} status - 'available' | 'licensed' | 'expired' | 'restricted'
 * @property {string} provider - License provider name (e.g. 'spotify', 'apple_music', 'local')
 * @property {string|null} licenseId - Provider-specific license identifier
 * @property {Date|null} expiresAt - When the license expires (null = no expiry)
 * @property {boolean} previewOnly - Whether only preview snippets are allowed
 * @property {number} maxPreviewSeconds - Maximum preview duration in seconds
 */

/**
 * @typedef {Object} Track
 * @property {string} id - Unique track identifier
 * @property {string} title - Track title
 * @property {string} artist - Artist name
 * @property {string|null} album - Album name
 * @property {number|null} durationSeconds - Full track duration in seconds
 * @property {string|null} previewUrl - URL for 30-second preview snippet
 * @property {string|null} fullUrl - URL for full track playback
 * @property {TagSet} tags - Mood, genre, and energy tags
 * @property {LicenseInfo} license - Licensing information
 * @property {Date|null} cacheExpiry - When cached data should be purged
 * @property {string} provider - Source provider ('spotify', 'apple_music', 'local')
 * @property {Object|null} providerMetadata - Raw provider-specific metadata
 * @property {Date} createdAt - When the track was added to library
 * @property {Date} updatedAt - When the track was last updated
 */

const VALID_MOODS = [
  'happy', 'sad', 'energetic', 'calm', 'angry', 'romantic',
  'mysterious', 'nostalgic', 'tense', 'peaceful', 'melancholy', 'uplifting'
];

const VALID_GENRES = [
  'pop', 'rock', 'classical', 'jazz', 'electronic', 'hip-hop',
  'country', 'r&b', 'folk', 'metal', 'indie', 'ambient', 'world'
];

const LICENSE_STATUSES = ['available', 'licensed', 'expired', 'restricted'];

const MAX_PREVIEW_SECONDS = 30;

/**
 * Creates a new Track object with defaults and validation.
 * @param {Object} data - Raw track data
 * @returns {Track}
 */
function createTrack(data) {
  if (!data.id) throw new Error('Track id is required');
  if (!data.title) throw new Error('Track title is required');
  if (!data.artist) throw new Error('Track artist is required');

  const tags = validateTags(data.tags || {});
  const license = validateLicense(data.license || {});

  return {
    id: String(data.id),
    title: String(data.title),
    artist: String(data.artist),
    album: data.album ? String(data.album) : null,
    durationSeconds: data.durationSeconds ? Number(data.durationSeconds) : null,
    previewUrl: data.previewUrl || null,
    fullUrl: data.fullUrl || null,
    tags,
    license,
    cacheExpiry: data.cacheExpiry ? new Date(data.cacheExpiry) : null,
    provider: data.provider || 'local',
    providerMetadata: data.providerMetadata || null,
    createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
    updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
  };
}

/**
 * Validates and normalizes tag data.
 * @param {Object} rawTags
 * @returns {TagSet}
 */
function validateTags(rawTags) {
  const mood = rawTags.mood && VALID_MOODS.includes(rawTags.mood)
    ? rawTags.mood
    : 'calm';

  const genre = rawTags.genre && VALID_GENRES.includes(rawTags.genre)
    ? rawTags.genre
    : 'pop';

  let energy = Number(rawTags.energy);
  if (isNaN(energy) || energy < 1 || energy > 5) energy = 3;
  energy = Math.round(energy);

  return { mood, genre, energy };
}

/**
 * Validates and normalizes license info.
 * @param {Object} rawLicense
 * @returns {LicenseInfo}
 */
function validateLicense(rawLicense) {
  const status = LICENSE_STATUSES.includes(rawLicense.status)
    ? rawLicense.status
    : 'available';

  const maxPreviewSeconds = rawLicense.maxPreviewSeconds
    ? Math.min(Number(rawLicense.maxPreviewSeconds), MAX_PREVIEW_SECONDS)
    : MAX_PREVIEW_SECONDS;

  return {
    status,
    provider: rawLicense.provider || 'local',
    licenseId: rawLicense.licenseId || null,
    expiresAt: rawLicense.expiresAt ? new Date(rawLicense.expiresAt) : null,
    previewOnly: Boolean(rawLicense.previewOnly),
    maxPreviewSeconds,
  };
}

/**
 * Checks if a track's license is currently valid for playback.
 * @param {Track} track
 * @returns {boolean}
 */
function isLicenseValid(track) {
  const { status, expiresAt } = track.license;
  if (status === 'expired' || status === 'restricted') return false;
  if (expiresAt && new Date() > expiresAt) return false;
  return true;
}

/**
 * Checks if a track's cache entry is still valid.
 * @param {Track} track
 * @returns {boolean}
 */
function isCacheValid(track) {
  if (!track.cacheExpiry) return false;
  return new Date() < track.cacheExpiry;
}

module.exports = {
  createTrack,
  validateTags,
  validateLicense,
  isLicenseValid,
  isCacheValid,
  VALID_MOODS,
  VALID_GENRES,
  LICENSE_STATUSES,
  MAX_PREVIEW_SECONDS,
};
