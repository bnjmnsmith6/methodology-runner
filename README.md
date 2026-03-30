# Supabase Data Layer & API Integration

**Project:** GUPPI Pipeline Tracker  
**Tier:** 3  
**Built by:** GUPPI (autonomous AI development pipeline)  
**Build cost:** $0.27  
**Build date:** 2026-03-26

## What was requested

GUPPI pipeline tracker needs a data layer to store and retrieve project pipeline status across stages (Research → Review → Spec → Build → Test → Ship)

## What was built

Built the GUPPI pipeline tracker data layer from scratch. Created an Express app with CORS, a Supabase client configured via environment variables, SQL migration defining projects and stage_transitions tables (with sequential stage enforcement trigger and realtime enabled), query functions for all CRUD operations, and route handlers for GET /api/projects, GET /api/projects/:id, POST /api/projects, PUT /api/projects/:id/stage, plus a Server-Sent Events endpoint for real-time updates. Note: requires SUPABASE_URL and SUPABASE_ANON_KEY env vars and the migration to be applied in Supabase dashboard before the server can run.

## Files

- package.json
- .env.example
- src/app.js
- src/lib/supabase.js
- src/queries/projectQueries.js
- src/routes/projects.js
- supabase/migrations/001_create_pipeline_schema.sql

---

*This project was built autonomously by GUPPI using Claude Code, PBCA Research, and the 10-step methodology.*
