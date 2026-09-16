import { Router, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import multer from 'multer';
import { calculateMonthlyDeliverables } from '../lib/report_deliverables';
import { populateDynamicDeliverables } from '../lib/deliverables';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit for images/screenshots
});

// Role access control: Admins (owner, team_leader) and Account Managers only
const reportsManagerOnly = (req: AuthRequest, res: Response, next: Function) => {
  if (!req.user || !['owner', 'team_leader', 'account_manager'].includes(req.user.role)) {
    res.status(403).json({ error: 'Access denied. Authorized for Admins and Account Managers only.' });
    return;
  }
  next();
};

// Helper to upload buffer to Supabase storage 'attachments'
async function uploadToStorage(buffer: Buffer, originalName: string, mimeType: string, folder: string): Promise<string> {
  const sanitizedName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `reports/${folder}/${Date.now()}_${sanitizedName}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from('attachments')
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Failed to upload to storage: ${uploadError.message}`);
  }

  const { data: urlData } = supabaseAdmin.storage
    .from('attachments')
    .getPublicUrl(storagePath);

  return urlData.publicUrl;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. DAILY REPORTS & LOGS
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/reports/daily — Fetch clients with daily logs for a given date
router.get('/daily', authMiddleware, reportsManagerOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetDate = req.query.date ? String(req.query.date) : new Date().toISOString().substring(0, 10);
    const clientId = req.query.clientId ? String(req.query.clientId) : null;

    // 1. Fetch closed clients (won only)
    let clientQuery = supabaseAdmin
      .from('clients')
      .select('id, name, company, email, phone, status, pipeline_stage, num_posts, num_reels, num_stories, num_photos, logo_url, created_at')
      .eq('pipeline_stage', 'won')
      .order('name', { ascending: true });

    if (clientId) {
      clientQuery = clientQuery.eq('id', clientId);
    }

    const { data: clients, error: clientErr } = await clientQuery;
    if (clientErr) {
      res.status(500).json({ error: clientErr.message });
      return;
    }

    // 2. Fetch logs for this date from client_daily_logs
    let logsQuery = supabaseAdmin
      .from('client_daily_logs')
      .select('*')
      .eq('log_date', targetDate)
      .order('created_at', { ascending: true });

    if (clientId) {
      logsQuery = logsQuery.eq('client_id', clientId);
    }

    const { data: rawLogs, error: logsErr } = await logsQuery;

    // If client_daily_logs table doesn't exist yet, return clients with empty logs gracefully
    if (logsErr && logsErr.code === 'PGRST205') {
      const emptyClients = (clients || []).map((c: any) => ({
        ...c,
        logs: [],
      }));
      res.json({ date: targetDate, clients: emptyClients, totalLogs: 0, pendingMigration: true });
      return;
    }

    if (logsErr) {
      res.status(500).json({ error: logsErr.message });
      return;
    }

    // 3. Fetch author profiles to attach user info
    const authorIds = Array.from(new Set((rawLogs || []).map((l: any) => l.author_id).filter(Boolean)));
    let authorMap: Record<string, any> = {};

    if (authorIds.length > 0) {
      const { data: authors } = await supabaseAdmin
        .from('profiles')
        .select('id, name, avatar_url, role')
        .in('id', authorIds);

      (authors || []).forEach((a: any) => {
        authorMap[a.id] = a;
      });
    }

    // Format logs with author details
    const formattedLogs = (rawLogs || []).map((l: any) => ({
      ...l,
      author: authorMap[l.author_id] || { id: l.author_id, name: 'Team Member', role: 'member' },
    }));

    // Attach logs to each client
    const logsByClient: Record<string, any[]> = {};
    formattedLogs.forEach((log: any) => {
      if (!logsByClient[log.client_id]) {
        logsByClient[log.client_id] = [];
      }
      logsByClient[log.client_id].push(log);
    });

    const populatedClients = await populateDynamicDeliverables(clients || []);

    const clientsWithLogs = populatedClients.map((c: any) => ({
      ...c,
      logs: logsByClient[c.id] || [],
    }));

    res.json({
      date: targetDate,
      clients: clientsWithLogs,
      totalLogs: formattedLogs.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch daily reports' });
  }
});

// POST /api/reports/daily — Insert a new daily log under a client
router.post('/daily', authMiddleware, reportsManagerOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const { client_id, content, category, log_date } = req.body;

  if (!client_id || !content || !content.trim()) {
    res.status(400).json({ error: 'Client ID and log content are required' });
    return;
  }

  const authorId = req.user!.id;
  const dateVal = log_date || new Date().toISOString().substring(0, 10);
  const catVal = category || 'general';

  try {
    const { data: newLog, error } = await supabaseAdmin
      .from('client_daily_logs')
      .insert({
        client_id,
        author_id: authorId,
        content: content.trim(),
        category: catVal,
        log_date: dateVal,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // Attach author info
    const { data: author } = await supabaseAdmin
      .from('profiles')
      .select('id, name, avatar_url, role')
      .eq('id', authorId)
      .maybeSingle();

    res.status(201).json({
      log: {
        ...newLog,
        author: author || { id: authorId, name: req.user!.email, role: req.user!.role },
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to insert daily log' });
  }
});

// PUT /api/reports/daily/:id — Edit an existing daily log
router.put('/daily/:id', authMiddleware, reportsManagerOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { content, category } = req.body;

  try {
    // Check permission: author or admin (owner / team_leader)
    const { data: existingLog, error: fetchErr } = await supabaseAdmin
      .from('client_daily_logs')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !existingLog) {
      res.status(404).json({ error: 'Log not found' });
      return;
    }

    const isOwnerOrLeader = ['owner', 'team_leader'].includes(req.user!.role);
    if (!isOwnerOrLeader && existingLog.author_id !== req.user!.id) {
      res.status(403).json({ error: 'You can only edit your own logs' });
      return;
    }

    const updates: any = { updated_at: new Date().toISOString() };
    if (content !== undefined) updates.content = content.trim();
    if (category !== undefined) updates.category = category;

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('client_daily_logs')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateErr) {
      res.status(500).json({ error: updateErr.message });
      return;
    }

    const { data: author } = await supabaseAdmin
      .from('profiles')
      .select('id, name, avatar_url, role')
      .eq('id', updated.author_id)
      .maybeSingle();

    res.json({
      log: {
        ...updated,
        author: author || { id: updated.author_id, name: 'Team Member', role: 'member' },
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update daily log' });
  }
});

// DELETE /api/reports/daily/:id — Delete a daily log
router.delete('/daily/:id', authMiddleware, reportsManagerOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const { data: existingLog, error: fetchErr } = await supabaseAdmin
      .from('client_daily_logs')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !existingLog) {
      res.status(404).json({ error: 'Log not found' });
      return;
    }

    const isOwnerOrLeader = ['owner', 'team_leader'].includes(req.user!.role);
    if (!isOwnerOrLeader && existingLog.author_id !== req.user!.id) {
      res.status(403).json({ error: 'You can only delete your own logs' });
      return;
    }

    const { error: delErr } = await supabaseAdmin
      .from('client_daily_logs')
      .delete()
      .eq('id', id);

    if (delErr) {
      res.status(500).json({ error: delErr.message });
      return;
    }

    res.json({ success: true, message: 'Log deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete daily log' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. MONTHLY REPORTS
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/reports/monthly — Fetch monthly reports for all clients for a specific month
router.get('/monthly', authMiddleware, reportsManagerOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetMonth = req.query.month ? String(req.query.month).substring(0, 7) : new Date().toISOString().substring(0, 7);
    const reportMonthDate = `${targetMonth}-01`;

    // 1. Fetch closed clients (won only)
    const { data: clients, error: clientErr } = await supabaseAdmin
      .from('clients')
      .select('id, name, company, email, phone, status, pipeline_stage, num_posts, num_reels, num_stories, num_photos, logo_url, created_at')
      .eq('pipeline_stage', 'won')
      .order('name', { ascending: true });

    if (clientErr) {
      res.status(500).json({ error: clientErr.message });
      return;
    }

    // 2. Fetch reports for this month
    const { data: reports, error: reportErr } = await supabaseAdmin
      .from('client_reports')
      .select('*')
      .eq('report_month', reportMonthDate);

    if (reportErr && reportErr.code !== 'PGRST205') {
      res.status(500).json({ error: reportErr.message });
      return;
    }

    const reportByClient: Record<string, any> = {};
    (reports || []).forEach((r: any) => {
      reportByClient[r.client_id] = r;
    });

    // 3. Map clients with report data (and compute auto deliverables counts)
    const clientsWithReports = await Promise.all(
      (clients || []).map(async (c: any) => {
        const rep = reportByClient[c.id] || null;
        let autoCounts = { num_posts: 0, num_reels: 0, num_stories: 0, num_photos: 0 };
        try {
          autoCounts = await calculateMonthlyDeliverables(c.id, targetMonth);
        } catch {
          // Ignore auto count failure
        }

        return {
          ...c,
          report: rep
            ? {
                ...rep,
                // If report counts are 0, offer autoCounts as dynamic fallback
                num_posts: rep.num_posts || autoCounts.num_posts,
                num_reels: rep.num_reels || autoCounts.num_reels,
                num_stories: rep.num_stories || autoCounts.num_stories,
                num_photos: rep.num_photos || autoCounts.num_photos,
                auto_counts: autoCounts,
              }
            : null,
          auto_counts: autoCounts,
        };
      })
    );

    res.json({
      month: targetMonth,
      clients: clientsWithReports,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch monthly reports' });
  }
});

// POST /api/reports/monthly — Create or update a client monthly report (supports multipart file uploads)
router.post(
  '/monthly',
  authMiddleware,
  reportsManagerOnly,
  upload.fields([
    { name: 'meta_insights_file', maxCount: 1 },
    { name: 'ads_screenshot_file', maxCount: 1 },
  ]),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const {
        client_id,
        report_month,
        num_posts,
        num_reels,
        num_stories,
        num_photos,
        ad_spend,
        roas,
        notes,
        meta_insights_image_url: existingMetaUrl,
        ads_screenshot_url: existingAdsUrl,
      } = req.body;

      if (!client_id || !report_month) {
        res.status(400).json({ error: 'Client ID and report month (YYYY-MM) are required' });
        return;
      }

      const ym = String(report_month).substring(0, 7);
      const reportDate = `${ym}-01`;

      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

      let metaInsightsUrl = existingMetaUrl || null;
      let adsScreenshotUrl = existingAdsUrl || null;

      // Handle Meta Insights image upload
      if (files?.['meta_insights_file']?.[0]) {
        const file = files['meta_insights_file'][0];
        metaInsightsUrl = await uploadToStorage(
          file.buffer,
          file.originalname,
          file.mimetype,
          `meta_insights/${client_id}`
        );
      }

      // Handle Ads Screenshot image upload
      if (files?.['ads_screenshot_file']?.[0]) {
        const file = files['ads_screenshot_file'][0];
        adsScreenshotUrl = await uploadToStorage(
          file.buffer,
          file.originalname,
          file.mimetype,
          `ads_screenshots/${client_id}`
        );
      }

      // Prepare upsert payload
      const payload: any = {
        client_id,
        report_month: reportDate,
        num_posts: num_posts !== undefined && num_posts !== '' ? parseInt(num_posts, 10) : 0,
        num_reels: num_reels !== undefined && num_reels !== '' ? parseInt(num_reels, 10) : 0,
        num_stories: num_stories !== undefined && num_stories !== '' ? parseInt(num_stories, 10) : 0,
        num_photos: num_photos !== undefined && num_photos !== '' ? parseInt(num_photos, 10) : 0,
        meta_insights_image_url: metaInsightsUrl,
        ads_screenshot_url: adsScreenshotUrl,
        ad_spend: ad_spend !== undefined && ad_spend !== '' ? parseFloat(ad_spend) : 0,
        roas: roas !== undefined && roas !== '' ? parseFloat(roas) : 0,
        notes: notes || null,
        created_by: req.user!.id,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabaseAdmin
        .from('client_reports')
        .upsert(payload, { onConflict: 'client_id,report_month' })
        .select()
        .single();

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.status(201).json({ report: data });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to save monthly report' });
    }
  }
);

// DELETE /api/reports/monthly/:id — Delete a monthly report
router.delete('/monthly/:id', authMiddleware, reportsManagerOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const { error } = await supabaseAdmin
      .from('client_reports')
      .delete()
      .eq('id', id);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ success: true, message: 'Monthly report deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete monthly report' });
  }
});

// POST /api/reports/upload — Direct standalone upload for report images
router.post(
  '/upload',
  authMiddleware,
  reportsManagerOnly,
  upload.single('file'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    try {
      const folder = req.body.folder || 'general';
      const url = await uploadToStorage(req.file.buffer, req.file.originalname, req.file.mimetype, folder);
      res.json({ url });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to upload image' });
    }
  }
);

export default router;
