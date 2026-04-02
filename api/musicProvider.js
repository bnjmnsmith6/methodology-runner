/**
 * External music API integration abstraction.
 * Supports Spotify Web API with fallback to local mock data.
 */

const { createTrack } = require('../models/Track');

/**
 * Provider configuration. In production, load from environment variables.
 */
const PROVIDERS = {
  spotify: {
    baseUrl: 'https://api.spotify.com/v1',
    authUrl: 'https://accounts.spotify.com/api/token',
    clientId: process.env.SPOTIFY_CLIENT_ID || null,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET || null,
  },
};

/**
 * In-memory token store for OAuth tokens.
 * @type {Map<string, { token: string, expiresAt: Date }>}
 */
const tokenStore = new Map();

/**
 * Authenticates with the given provider and stores the access token.
 * @param {'spotify'|'local'} provider
 * @returns {Promise<string>} Access token
 */
async function authenticate(provider = 'spotify') {
  if (provider === 'local') return 'local-mock-token';

  const config = PROVIDERS[provider];
  if (!config) throw new Error(`Unknown provider: ${provider}`);

  if (!config.clientId || !config.clientSecret) {
    throw new Error(
      `${provider} credentials not configured. Set ${provider.toUpperCase()}_CLIENT_ID and ${provider.toUpperCase()}_CLIENT_SECRET environment variables.`
    );
  }

  // Return cached token if still valid
  const cached = tokenStore.get(provider);
  if (cached && new Date() < cached.expiresAt) {
    return cached.token;
  }

  // Request new token using Client Credentials flow
  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');

  const response = await fetch(config.authUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Authentication failed for ${provider}: ${error}`);
  }

  const data = await response.json();
  const expiresAt = new Date(Date.now() + data.expires_in * 1000 - 60000); // 1 min buffer

  tokenStore.set(provider, { token: data.access_token, expiresAt });
  return data.access_token;
}

/**
 * Fetches tracks from the provider matching the given mood and genre.
 * @param {Object} params
 * @param {string} params.mood
 * @param {string} [params.genre]
 * @param {number} [params.energy] - 1-5
 * @param {number} [params.limit]
 * @param {'spotify'|'local'} [params.provider]
 * @returns {Promise<import('../models/Track').Track[]>}
 */
async function fetchTracks({ mood, genre, energy, limit = 20, provider = 'spotify' }) {
  if (provider === 'local' || !PROVIDERS[provider]?.clientId) {
    return fetchMockTracks({ mood, genre, energy, limit });
  }

  const token = await authenticate(provider);
  const query = buildSpotifyQuery(mood, genre, energy);

  const params = new URLSearchParams({
    q: query,
    type: 'track',
    limit: String(Math.min(limit, 50)),
  });

  const response = await fetch(`${PROVIDERS.spotify.baseUrl}/search?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Spotify search failed: ${error}`);
  }

  const data = await response.json();
  return data.tracks.items.map(item => normalizeSpotifyTrack(item, mood, genre, energy));
}

/**
 * Retrieves preview URL for a track from the provider.
 * @param {string} trackId - Provider track ID
 * @param {'spotify'|'local'} [provider]
 * @returns {Promise<string|null>} Preview URL or null
 */
async function getPreview(trackId, provider = 'spotify') {
  if (provider === 'local') return null;

  const token = await authenticate(provider);

  const response = await fetch(`${PROVIDERS.spotify.baseUrl}/tracks/${trackId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) return null;

  const data = await response.json();
  return data.preview_url || null;
}

/**
 * Builds a Spotify search query string from mood/genre/energy params.
 * @param {string} mood
 * @param {string|undefined} genre
 * @param {number|undefined} energy
 * @returns {string}
 */
function buildSpotifyQuery(mood, genre, energy) {
  const parts = [mood];
  if (genre) parts.push(`genre:${genre}`);
  return parts.join(' ');
}

/**
 * Normalizes a Spotify API track object into our Track model.
 * @param {Object} spotifyTrack
 * @param {string} mood
 * @param {string|undefined} genre
 * @param {number|undefined} energy
 * @returns {import('../models/Track').Track}
 */
function normalizeSpotifyTrack(spotifyTrack, mood, genre, energy) {
  return createTrack({
    id: `spotify:${spotifyTrack.id}`,
    title: spotifyTrack.name,
    artist: spotifyTrack.artists.map(a => a.name).join(', '),
    album: spotifyTrack.album?.name || null,
    durationSeconds: spotifyTrack.duration_ms ? Math.floor(spotifyTrack.duration_ms / 1000) : null,
    previewUrl: spotifyTrack.preview_url || null,
    fullUrl: null, // Full URL requires user auth, not available via Client Credentials
    tags: {
      mood: mood || 'calm',
      genre: genre || 'pop',
      energy: energy || 3,
    },
    license: {
      status: 'licensed',
      provider: 'spotify',
      licenseId: spotifyTrack.id,
      previewOnly: true,
      maxPreviewSeconds: 30,
    },
    provider: 'spotify',
    providerMetadata: {
      spotifyId: spotifyTrack.id,
      popularity: spotifyTrack.popularity,
      explicit: spotifyTrack.explicit,
    },
  });
}

/**
 * Returns mock tracks for local/offline/testing use.
 * These simulate a curated library tagged with mood/genre/energy.
 * @param {Object} params
 * @returns {import('../models/Track').Track[]}
 */
function fetchMockTracks({ mood, genre, energy, limit = 20 }) {
  const mockLibrary = getMockLibrary();

  let results = mockLibrary.filter(t => {
    if (mood && t.tags.mood !== mood) return false;
    if (genre && t.tags.genre !== genre) return false;
    if (energy !== undefined) {
      if (Math.abs(t.tags.energy - energy) > 1) return false;
    }
    return true;
  });

  return results.slice(0, limit);
}

/**
 * Returns the built-in mock music library for testing and offline fallback.
 * @returns {import('../models/Track').Track[]}
 */
function getMockLibrary() {
  const mockData = [
    {
      id: 'local:001', title: 'Sunny Day', artist: 'The Bright Ones', album: 'Summer Vibes',
      durationSeconds: 210, previewUrl: null, fullUrl: null,
      tags: { mood: 'happy', genre: 'pop', energy: 4 },
      license: { status: 'available', provider: 'local', previewOnly: false, maxPreviewSeconds: 30 },
    },
    {
      id: 'local:002', title: 'Ocean Breeze', artist: 'Calm Waters', album: 'Relaxation Vol.1',
      durationSeconds: 180, previewUrl: null, fullUrl: null,
      tags: { mood: 'calm', genre: 'ambient', energy: 1 },
      license: { status: 'available', provider: 'local', previewOnly: false, maxPreviewSeconds: 30 },
    },
    {
      id: 'local:003', title: 'Storm Rising', artist: 'Thunder Drive', album: 'Electric Night',
      durationSeconds: 240, previewUrl: null, fullUrl: null,
      tags: { mood: 'energetic', genre: 'rock', energy: 5 },
      license: { status: 'available', provider: 'local', previewOnly: false, maxPreviewSeconds: 30 },
    },
    {
      id: 'local:004', title: 'Rainy Window', artist: 'Blue Mood', album: 'Autumn',
      durationSeconds: 200, previewUrl: null, fullUrl: null,
      tags: { mood: 'sad', genre: 'indie', energy: 2 },
      license: { status: 'available', provider: 'local', previewOnly: false, maxPreviewSeconds: 30 },
    },
    {
      id: 'local:005', title: 'Midnight Jazz', artist: 'The Quarter Notes', album: 'Late Night',
      durationSeconds: 300, previewUrl: null, fullUrl: null,
      tags: { mood: 'mysterious', genre: 'jazz', energy: 2 },
      license: { status: 'available', provider: 'local', previewOnly: false, maxPreviewSeconds: 30 },
    },
    {
      id: 'local:006', title: 'First Dance', artist: 'Rose & Reed', album: 'Celebrations',
      durationSeconds: 220, previewUrl: null, fullUrl: null,
      tags: { mood: 'romantic', genre: 'pop', energy: 3 },
      license: { status: 'available', provider: 'local', previewOnly: false, maxPreviewSeconds: 30 },
    },
    {
      id: 'local:007', title: 'Daybreak Run', artist: 'Morning Pulse', album: 'Fitness Mix',
      durationSeconds: 195, previewUrl: null, fullUrl: null,
      tags: { mood: 'energetic', genre: 'electronic', energy: 5 },
      license: { status: 'available', provider: 'local', previewOnly: false, maxPreviewSeconds: 30 },
    },
    {
      id: 'local:008', title: 'Old Photograph', artist: 'Memory Lane', album: 'Nostalgia',
      durationSeconds: 250, previewUrl: null, fullUrl: null,
      tags: { mood: 'nostalgic', genre: 'folk', energy: 2 },
      license: { status: 'available', provider: 'local', previewOnly: false, maxPreviewSeconds: 30 },
    },
    {
      id: 'local:009', title: 'Victory Lap', artist: 'Champions', album: 'Rise Up',
      durationSeconds: 185, previewUrl: null, fullUrl: null,
      tags: { mood: 'uplifting', genre: 'pop', energy: 4 },
      license: { status: 'available', provider: 'local', previewOnly: false, maxPreviewSeconds: 30 },
    },
    {
      id: 'local:010', title: 'Forgotten Road', artist: 'Wanderer', album: 'Distance',
      durationSeconds: 270, previewUrl: null, fullUrl: null,
      tags: { mood: 'melancholy', genre: 'country', energy: 2 },
      license: { status: 'available', provider: 'local', previewOnly: false, maxPreviewSeconds: 30 },
    },
  ];

  return mockData.map(d => createTrack(d));
}

module.exports = {
  authenticate,
  fetchTracks,
  getPreview,
  getMockLibrary,
  fetchMockTracks,
};
