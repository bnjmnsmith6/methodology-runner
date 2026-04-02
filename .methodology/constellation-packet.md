@@JOB_TYPE: CLAUDE_SPEC
@@SPEC_STATUS: READY
@@CONFIDENCE: MEDIUM
@@OPEN_DECISIONS: 0
@@OPEN_ASSUMPTIONS: 3
@@END_HEADER

# Constellation Packet

## 1. Objective
- **Problem**: Need legal music access with mood/genre tagging for photo theme song matching
- **Desired outcome**: Searchable music library with preview/full playback, legally compliant
- **Success checks**: Can search by mood/genre, play previews, handle licensing constraints, cache for offline

## 2. In scope / Out of scope

**In scope:**
- Music library database schema and API integration
- Mood/genre/energy tagging system
- Preview snippet playback
- Basic caching for offline access
- Licensing compliance tracking
- Search interface for mood detection system

**Out of scope:**
- Actual licensing negotiations (business responsibility)
- Music recommendation algorithms
- User playlist management
- Audio processing/analysis
- Payment processing for premium tracks

## 3. Source-of-truth constraints
- All music playback must respect licensing terms
- Preview length must not exceed provider limits (typically 30 seconds)
- Cache retention must comply with licensing agreements
- Must track usage for royalty reporting
- No music files stored permanently without explicit rights

## 4. Architecture and flow
- **Components**: MusicLibrary, LicenseManager, CacheManager, TagSearcher
- **Data flow**: API provider → license check → tag extraction → database storage → search interface
- **State transitions**: Available → Licensed → Cached → Playable → Expired
- **External dependencies**: Spotify/Apple Music APIs, licensing verification service

## 5. Contracts and invariants
- **Music track schema**: id, title, artist, preview_url, full_url, tags{mood, genre, energy}, license_status, cache_expiry
- **Search interface**: `searchByMood(mood: string, energy: 1-5) → Track[]`
- **License check**: Every playback request must verify current license status
- **Cache invariant**: Cached items auto-expire per license terms

## 6. File-by-file implementation plan

**`models/Track.js`**
- Purpose: Core music track data model
- Change: Create new file
- Key types: Track, LicenseInfo, TagSet

**`services/MusicLibraryService.js`**
- Purpose: Main music library operations
- Change: Create new file  
- Key functions: searchTracks(), getTrack(), refreshLibrary()

**`services/LicenseManager.js`**
- Purpose: License compliance and validation
- Change: Create new file
- Key functions: validateLicense(), trackUsage(), checkExpiry()

**`services/CacheManager.js`**
- Purpose: Offline caching with TTL
- Change: Create new file
- Key functions: cacheTrack(), getCached(), cleanExpired()

**`api/musicProvider.js`**
- Purpose: External API integration abstraction
- Change: Create new file
- Key functions: fetchTracks(), getPreview(), authenticate()

**`database/migrations/add_music_tables.sql`**
- Purpose: Database schema for music library
- Change: Create new migration
- Tables: tracks, licenses, cache_entries, usage_logs

## 7. Build order
1. Create Track model and database schema
2. Implement LicenseManager with basic validation
3. Build MusicLibraryService core CRUD operations
4. Add external API provider integration
5. Implement TagSearcher with mood/genre indexing
6. Add CacheManager with TTL support
7. Integration testing with mock licensing data

## 8. Acceptance tests
- Can search for "happy" mood tracks and get relevant results
- Preview playback stops at 30 seconds automatically
- Cached tracks expire and are removed on schedule
- License validation blocks playback of expired content
- Usage tracking logs all preview/full plays correctly
- Offline mode serves cached content when available

## 9. Risks, assumptions, and rollback
**Assumptions:**
1. Will use Spotify Web API as primary provider (fallback to local mock data)
2. Preview snippets count as fair use for app functionality
3. Simple tag-based search sufficient initially (no ML ranking)

**Risk hotspots:**
- API rate limiting during bulk library refresh
- Cache size growth without proper cleanup
- License status becoming stale

**Rollback:** Disable music features, fall back to silent photo browsing

## 10. Escalate instead of guessing
- If specific licensing terms conflict with technical implementation
- If external API changes authentication or rate limiting unexpectedly  
- If cache storage requirements exceed reasonable app size limits
- If preview length restrictions vary significantly between providers