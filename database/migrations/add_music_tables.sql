-- Music Library Database Migration
-- Creates tables: tracks, licenses, cache_entries, usage_logs

-- Tracks table: core music data with mood/genre/energy tags
CREATE TABLE IF NOT EXISTS tracks (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    artist VARCHAR(500) NOT NULL,
    album VARCHAR(500),
    duration_seconds INTEGER,
    preview_url TEXT,
    full_url TEXT,
    provider VARCHAR(100) NOT NULL DEFAULT 'local',
    provider_metadata JSONB,
    -- Tag columns for efficient searching
    mood VARCHAR(100) NOT NULL DEFAULT 'calm',
    genre VARCHAR(100) NOT NULL DEFAULT 'pop',
    energy SMALLINT NOT NULL DEFAULT 3 CHECK (energy BETWEEN 1 AND 5),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracks_mood ON tracks(mood);
CREATE INDEX IF NOT EXISTS idx_tracks_genre ON tracks(genre);
CREATE INDEX IF NOT EXISTS idx_tracks_energy ON tracks(energy);
CREATE INDEX IF NOT EXISTS idx_tracks_mood_energy ON tracks(mood, energy);
CREATE INDEX IF NOT EXISTS idx_tracks_provider ON tracks(provider);

-- Licenses table: tracks licensing information
CREATE TABLE IF NOT EXISTS licenses (
    id SERIAL PRIMARY KEY,
    track_id VARCHAR(255) NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'available'
        CHECK (status IN ('available', 'licensed', 'expired', 'restricted')),
    provider VARCHAR(100) NOT NULL,
    license_id VARCHAR(255),
    preview_only BOOLEAN NOT NULL DEFAULT FALSE,
    max_preview_seconds SMALLINT NOT NULL DEFAULT 30 CHECK (max_preview_seconds <= 30),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(track_id)
);

CREATE INDEX IF NOT EXISTS idx_licenses_track_id ON licenses(track_id);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);
CREATE INDEX IF NOT EXISTS idx_licenses_expires_at ON licenses(expires_at);

-- Cache entries table: offline access with TTL enforcement
CREATE TABLE IF NOT EXISTS cache_entries (
    id SERIAL PRIMARY KEY,
    track_id VARCHAR(255) NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    cache_type VARCHAR(50) NOT NULL CHECK (cache_type IN ('preview', 'full')),
    local_path TEXT,
    size_bytes BIGINT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(track_id, cache_type)
);

CREATE INDEX IF NOT EXISTS idx_cache_entries_track_id ON cache_entries(track_id);
CREATE INDEX IF NOT EXISTS idx_cache_entries_expires_at ON cache_entries(expires_at);

-- Usage logs table: royalty reporting and playback tracking
CREATE TABLE IF NOT EXISTS usage_logs (
    id BIGSERIAL PRIMARY KEY,
    track_id VARCHAR(255) NOT NULL REFERENCES tracks(id) ON DELETE SET NULL,
    play_type VARCHAR(50) NOT NULL CHECK (play_type IN ('preview', 'full')),
    duration_played_seconds INTEGER NOT NULL DEFAULT 0,
    was_cached BOOLEAN NOT NULL DEFAULT FALSE,
    user_session_id VARCHAR(255),
    context JSONB,
    played_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_logs_track_id ON usage_logs(track_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_played_at ON usage_logs(played_at);
CREATE INDEX IF NOT EXISTS idx_usage_logs_play_type ON usage_logs(play_type);

-- Function to auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tracks_updated_at
    BEFORE UPDATE ON tracks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_licenses_updated_at
    BEFORE UPDATE ON licenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
