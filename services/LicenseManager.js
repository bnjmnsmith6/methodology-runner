/**
 * License compliance and validation service.
 * Tracks usage for royalty reporting and enforces license constraints.
 */

const { isLicenseValid, MAX_PREVIEW_SECONDS } = require('../models/Track');

/**
 * In-memory usage log store. In production this would write to database.
 * @type {Array<Object>}
 */
const usageLogs = [];

/**
 * Validates whether a track can be played according to its license.
 * @param {import('../models/Track').Track} track
 * @param {'preview'|'full'} playType
 * @returns {{ allowed: boolean, reason: string|null }}
 */
function validateLicense(track, playType = 'preview') {
  if (!isLicenseValid(track)) {
    const reason = track.license.status === 'expired' || isExpired(track.license)
      ? 'License has expired'
      : `License status is "${track.license.status}"`;
    return { allowed: false, reason };
  }

  if (playType === 'full' && track.license.previewOnly) {
    return { allowed: false, reason: 'Only preview playback is licensed for this track' };
  }

  if (!track.previewUrl && !track.fullUrl) {
    return { allowed: false, reason: 'No playback URL available for this track' };
  }

  if (playType === 'preview' && !track.previewUrl) {
    return { allowed: false, reason: 'No preview URL available' };
  }

  if (playType === 'full' && !track.fullUrl) {
    return { allowed: false, reason: 'No full playback URL available' };
  }

  return { allowed: true, reason: null };
}

/**
 * Checks if a license is expired based on its expiresAt date.
 * @param {import('../models/Track').LicenseInfo} licenseInfo
 * @returns {boolean}
 */
function isExpired(licenseInfo) {
  if (!licenseInfo.expiresAt) return false;
  return new Date() > new Date(licenseInfo.expiresAt);
}

/**
 * Returns the maximum allowed preview duration for a track.
 * Enforces global MAX_PREVIEW_SECONDS cap regardless of license terms.
 * @param {import('../models/Track').Track} track
 * @returns {number} seconds
 */
function getMaxPreviewDuration(track) {
  const licenseMax = track.license.maxPreviewSeconds || MAX_PREVIEW_SECONDS;
  return Math.min(licenseMax, MAX_PREVIEW_SECONDS);
}

/**
 * Logs a playback event for royalty reporting.
 * @param {string} trackId
 * @param {'preview'|'full'} playType
 * @param {number} durationPlayedSeconds
 * @param {Object} [options]
 * @param {boolean} [options.wasCached]
 * @param {string} [options.userSessionId]
 * @param {Object} [options.context]
 * @returns {Object} The created usage log entry
 */
function trackUsage(trackId, playType, durationPlayedSeconds, options = {}) {
  if (!trackId) throw new Error('trackId is required for usage tracking');
  if (!['preview', 'full'].includes(playType)) {
    throw new Error('playType must be "preview" or "full"');
  }

  // Enforce preview length cap in usage logs
  const loggedDuration = playType === 'preview'
    ? Math.min(durationPlayedSeconds, MAX_PREVIEW_SECONDS)
    : durationPlayedSeconds;

  const entry = {
    id: usageLogs.length + 1,
    trackId,
    playType,
    durationPlayedSeconds: loggedDuration,
    wasCached: Boolean(options.wasCached),
    userSessionId: options.userSessionId || null,
    context: options.context || null,
    playedAt: new Date(),
  };

  usageLogs.push(entry);
  return entry;
}

/**
 * Checks if a license is approaching expiry within a threshold.
 * @param {import('../models/Track').LicenseInfo} licenseInfo
 * @param {number} [thresholdDays=7]
 * @returns {boolean}
 */
function checkExpiry(licenseInfo, thresholdDays = 7) {
  if (!licenseInfo.expiresAt) return false;
  const expiry = new Date(licenseInfo.expiresAt);
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + thresholdDays);
  return expiry <= threshold;
}

/**
 * Returns usage logs for a given track, optionally filtered by date range.
 * @param {string} trackId
 * @param {Object} [options]
 * @param {Date} [options.from]
 * @param {Date} [options.to]
 * @returns {Array<Object>}
 */
function getUsageReport(trackId, options = {}) {
  let logs = usageLogs.filter(l => l.trackId === trackId);

  if (options.from) {
    logs = logs.filter(l => l.playedAt >= new Date(options.from));
  }
  if (options.to) {
    logs = logs.filter(l => l.playedAt <= new Date(options.to));
  }

  return logs;
}

/**
 * Returns all usage logs (for royalty reporting exports).
 * @returns {Array<Object>}
 */
function getAllUsageLogs() {
  return [...usageLogs];
}

/**
 * Clears usage logs (for testing purposes only).
 */
function _clearUsageLogs() {
  usageLogs.length = 0;
}

module.exports = {
  validateLicense,
  isExpired,
  getMaxPreviewDuration,
  trackUsage,
  checkExpiry,
  getUsageReport,
  getAllUsageLogs,
  _clearUsageLogs,
};
