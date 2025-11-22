import { serve } from '@hono/node-server';
import { Hono, Context, Next } from 'hono';
import { cors } from 'hono/cors';
import { v4 as uuidv4 } from 'uuid';
import { executeDeepIntelligence } from './deep-intelligence';
import { WarRoomMissionContext } from './types';
import { JobManager } from './cron/storage';
import { startScheduler } from './cron/scheduler';

type Bindings = {
  Variables: {
    userId: string;
  };
};

const app = new Hono<Bindings>();

app.use('/*', cors());

// Initialize Background Scheduler
startScheduler();

// Auth Middleware (Placeholder for Clerk/Auth0)
const authMiddleware = async (c: Context<Bindings>, next: Next) => {
  const userId = c.req.header('X-User-ID') || 'default_user';
  c.set('userId', userId);
  await next();
};

app.get('/', (c) => c.json({ status: 'Signl API Online', version: '5.0.0' }));

// --- PRIMARY ENDPOINT: TRIGGER DEEP INTELLIGENCE ---
app.post('/api/signl/trigger', async (c) => {
  try {
    const body = await c.req.json() as WarRoomMissionContext;
    
    // Validation
    if (!body.identity?.email) {
      return c.json({ error: "Missing 'identity.email'" }, 400);
    }
    if (!body.company?.name) {
      return c.json({ error: "Missing 'company.name'" }, 400);
    }
    if (!body.targets?.competitorNames || body.targets.competitorNames.length === 0) {
      return c.json({ error: "At least one competitor name is required." }, 400);
    }

    const missionId = uuidv4();
    const durationMinutes = 45; // Set default production duration

    console.log(`[API] Received mission ${missionId} for ${body.company.name}`);

    // Fire & Forget: Execute logic in background so API doesn't timeout
    executeDeepIntelligence(missionId, body, durationMinutes)
      .catch(err => console.error(`[API] Mission ${missionId} Crashed:`, err));

    return c.json({ 
      success: true, 
      missionId: missionId,
      status: "deployed",
      message: `Intelligence agents deployed. Report will be sent to ${body.identity.email} in ~${durationMinutes} minutes.` 
    });

  } catch (e) {
    console.error("[API] Error parsing request:", e);
    return c.json({ error: "Invalid JSON payload" }, 500);
  }
});

// --- CRON JOB ENDPOINTS ---

app.get('/api/jobs', authMiddleware, (c) => {
  const userId = c.get('userId');
  const jobs = JobManager.listUserJobs(userId);
  return c.json({ jobs });
});

app.post('/api/jobs', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  
  if (!body.targetName || !body.templateId || !body.userEmail) {
    return c.json({ error: "Missing required job fields (targetName, templateId, userEmail)" }, 400);
  }

  const id = JobManager.createJob({
    ...body,
    userId,
    targetUrl: body.targetUrl || "https://google.com", 
    frequency: body.frequency || 'DAILY_MORNING'
  });

  return c.json({ success: true, jobId: id });
});

app.delete('/api/jobs/:id', authMiddleware, (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  JobManager.deleteJob(id, userId);
  return c.json({ success: true });
});

const port = 4000;
console.log(`🚀 Signl Server running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port
});