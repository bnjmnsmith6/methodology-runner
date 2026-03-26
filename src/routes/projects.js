import { Router } from 'express';
import {
  getAllProjects,
  getProjectById,
  createProject,
  updateProjectStage,
} from '../queries/projectQueries.js';
import { supabase } from '../lib/supabase.js';

const router = Router();

const VALID_STAGES = ['research', 'review', 'spec', 'build', 'test', 'ship'];

// GET /api/projects - list all projects with current stages
router.get('/', async (req, res) => {
  try {
    const projects = await getAllProjects();
    res.json({ projects });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id - single project with stage history
router.get('/:id', async (req, res) => {
  try {
    const project = await getProjectById(req.params.id);
    res.json({ project });
  } catch (err) {
    if (err.code === 'PGRST116') {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects - create new project in 'research' stage
router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Project name is required' });
  }
  try {
    const project = await createProject(name.trim());
    res.status(201).json({ project });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/projects/:id/stage - advance project to next pipeline stage
router.put('/:id/stage', async (req, res) => {
  const { stage } = req.body;
  if (!stage || !VALID_STAGES.includes(stage)) {
    return res.status(400).json({
      error: `Invalid stage. Must be one of: ${VALID_STAGES.join(', ')}`,
    });
  }
  try {
    const project = await updateProjectStage(req.params.id, stage);
    res.json({ project });
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({ error: err.message });
    }
    if (err.code === 'PGRST116') {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/realtime/token - get realtime subscription info
// Frontend uses this to set up its own Supabase realtime subscription
router.get('/realtime/token', (req, res) => {
  res.json({
    table: 'projects',
    event: '*',
    instructions: 'Subscribe to the projects table using the Supabase client with SUPABASE_URL and SUPABASE_ANON_KEY',
    supabase_url: process.env.SUPABASE_URL,
  });
});

// Server-Sent Events endpoint for real-time project updates
router.get('/realtime/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const channel = supabase
    .channel('projects-stream')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, (payload) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    })
    .subscribe();

  req.on('close', () => {
    supabase.removeChannel(channel);
  });
});

export default router;
