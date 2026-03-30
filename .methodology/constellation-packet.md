@@JOB_TYPE: CLAUDE_SPEC
@@SPEC_STATUS: READY
@@CONFIDENCE: MEDIUM
@@OPEN_DECISIONS: 0
@@OPEN_ASSUMPTIONS: 3
@@END_HEADER

# Constellation Packet

## 1. Objective
- **Problem**: GUPPI pipeline tracker needs a data layer to store and retrieve project pipeline status across stages (Research → Review → Spec → Build → Test → Ship)
- **Desired outcome**: Functional Supabase schema + Express API endpoint that serves project pipeline data with real-time update capability
- **Success checks**: API returns project status, stage durations, and supports real-time subscriptions

## 2. In scope / Out of scope

**In scope:**
- Supabase database schema design for pipeline tracking
- SQL queries for project status and stage duration calculations
- Express API endpoint `/api/projects` or similar
- Real-time subscription setup via Supabase
- Basic CRUD operations for project pipeline data

**Out of scope:**
- Frontend implementation
- Authentication/authorization
- Complex analytics or reporting
- Historical data migration
- Performance optimization beyond basic indexing

## 3. Source-of-truth constraints
- Pipeline stages must be: Research → Review → Spec → Build → Test → Ship
- Stage transitions must be timestamped
- Projects must have unique identifiers
- Real-time updates must use Supabase's built-in realtime features
- Express server must handle CORS for frontend integration

## 4. Architecture and flow
- **Components**: Supabase database, Express API server, Supabase client
- **Data flow**: 
  1. Project data stored in Supabase tables
  2. Express server queries Supabase via client library
  3. API endpoints expose project data to frontend
  4. Real-time subscriptions push updates to connected clients
- **State transitions**: Projects move through pipeline stages with timestamps
- **External dependencies**: Supabase (database + realtime), Express.js

## 5. Contracts and invariants
- **Project schema**: `{ id, name, current_stage, created_at, updated_at }`
- **Stage transition schema**: `{ id, project_id, stage, entered_at, exited_at }`
- **API response format**: JSON with project list and individual project details
- **Stage enum**: ['research', 'review', 'spec', 'build', 'test', 'ship']
- **Timestamps**: ISO 8601 format, UTC timezone

## 6. File-by-file implementation plan

**`supabase/migrations/001_create_pipeline_schema.sql`**
- Purpose: Define database schema
- Change: Create new migration file
- Key structures: projects table, stage_transitions table, indexes

**`src/lib/supabase.js`**
- Purpose: Supabase client configuration
- Change: Create new file
- Key functions: `createClient()`, connection setup

**`src/routes/projects.js`**
- Purpose: Express route handlers for project API
- Change: Create new file  
- Key functions: `GET /projects`, `GET /projects/:id`, `POST /projects`, `PUT /projects/:id`

**`src/queries/projectQueries.js`**
- Purpose: Supabase query functions
- Change: Create new file
- Key functions: `getAllProjects()`, `getProjectById()`, `updateProjectStage()`, `getStageHistory()`

**`src/app.js`**
- Purpose: Express app configuration
- Change: Add projects router import and middleware
- Key additions: Router mounting, CORS setup for Supabase domain

## 7. Build order
1. Create Supabase migration and run it
2. Set up Supabase client configuration
3. Create project query functions
4. Build Express route handlers
5. Wire routes into main Express app
6. Test API endpoints manually
7. Implement real-time subscription endpoint

## 8. Acceptance tests
- `GET /api/projects` returns array of projects with current stages
- `GET /api/projects/:id` returns single project with stage history
- `POST /api/projects` creates new project in 'research' stage
- `PUT /api/projects/:id/stage` advances project to next pipeline stage
- Real-time subscription receives updates when project stages change
- Database enforces stage transition order constraints
- All timestamps are properly formatted and UTC

## 9. Risks, assumptions, and rollback

**Open assumptions:**
1. Supabase instance is already provisioned and accessible
2. Express server structure exists and can be extended
3. Frontend will handle real-time subscription client-side logic

**Risk hotspots:**
- Supabase connection configuration and environment variables
- Real-time subscription setup complexity
- Stage transition validation logic

**Rollback plan:**
- Migration can be reverted via Supabase dashboard
- Route files can be removed without affecting existing Express functionality
- No data loss risk as this is new functionality

## 10. Escalate instead of guessing
- **STOP_AND_ASK if:** Supabase credentials or connection details are not available
- **STOP_AND_ASK if:** Express server structure doesn't exist or conflicts with existing routes
- **STOP_AND_ASK if:** Stage transition business logic requires approval (e.g., can projects skip stages?)
- **STOP_AND_ASK if:** Real-time subscription implementation hits Supabase plan limits or technical barriers