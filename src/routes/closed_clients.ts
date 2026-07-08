import { Router, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { ownerOrSalesOrTeamLeaderOrAccountManager } from '../middleware/roleCheck';
import multer from 'multer';
import { populateDynamicDeliverables } from '../lib/deliverables';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
});

// ── List all won clients ─────────────────────────────────────────────────
router.get('/', authMiddleware, ownerOrSalesOrTeamLeaderOrAccountManager, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('clients')
      .select('*')
      .eq('pipeline_stage', 'won')
      .order('created_at', { ascending: false });

    if (error) { res.status(500).json({ error: error.message }); return; }
    const populated = await populateDynamicDeliverables(data || []);
    res.json({ clients: populated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch closed clients' });
  }
});

// ── Get single won client ────────────────────────────────────────────────
router.get('/:id', authMiddleware, ownerOrSalesOrTeamLeaderOrAccountManager, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    const { data, error } = await supabaseAdmin
      .from('clients')
      .select('*')
      .eq('id', id)
      .eq('pipeline_stage', 'won')
      .single();

    if (error) { res.status(404).json({ error: 'Client not found' }); return; }
    const populated = await populateDynamicDeliverables([data]);
    res.json({ client: populated[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch client' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// FAQ CRUD
// ═══════════════════════════════════════════════════════════════════════════

router.get('/:id/faq', authMiddleware, ownerOrSalesOrTeamLeaderOrAccountManager, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    const { data, error } = await supabaseAdmin
      .from('client_faq')
      .select('*')
      .eq('client_id', id)
      .order('sort_order', { ascending: true });

    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ faq: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch FAQ' });
  }
});

router.post('/:id/faq', authMiddleware, ownerOrSalesOrTeamLeaderOrAccountManager, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { question, answer, sort_order } = req.body;

  if (!question || !answer) {
    res.status(400).json({ error: 'Question and answer are required' });
    return;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('client_faq')
      .insert({ client_id: id, question, answer, sort_order: sort_order ?? 0 })
      .select()
      .single();

    if (error) { res.status(500).json({ error: error.message }); return; }
    res.status(201).json({ faq: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create FAQ' });
  }
});

router.put('/:id/faq/:faqId', authMiddleware, ownerOrSalesOrTeamLeaderOrAccountManager, async (req: AuthRequest, res: Response): Promise<void> => {
  const { faqId } = req.params;
  const { question, answer, sort_order } = req.body;

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (question !== undefined) updates.question = question;
  if (answer !== undefined) updates.answer = answer;
  if (sort_order !== undefined) updates.sort_order = sort_order;

  try {
    const { data, error } = await supabaseAdmin
      .from('client_faq')
      .update(updates)
      .eq('id', faqId)
      .select()
      .single();

    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ faq: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update FAQ' });
  }
});

router.delete('/:id/faq/:faqId', authMiddleware, ownerOrSalesOrTeamLeaderOrAccountManager, async (req: AuthRequest, res: Response): Promise<void> => {
  const { faqId } = req.params;
  try {
    const { error } = await supabaseAdmin.from('client_faq').delete().eq('id', faqId);
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ message: 'FAQ deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete FAQ' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CONTENT PLANS CRUD
// ═══════════════════════════════════════════════════════════════════════════

router.get('/:id/content-plans', authMiddleware, ownerOrSalesOrTeamLeaderOrAccountManager, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    const { data, error } = await supabaseAdmin
      .from('client_content_plans')
      .select('*')
      .eq('client_id', id)
      .order('created_at', { ascending: false });

    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ plans: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch content plans' });
  }
});

router.post('/:id/content-plans', authMiddleware, ownerOrSalesOrTeamLeaderOrAccountManager, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { title, description, content_type, status, scheduled_date, drive_link, notes } = req.body;

  if (!title) { res.status(400).json({ error: 'Title is required' }); return; }

  try {
    const { data, error } = await supabaseAdmin
      .from('client_content_plans')
      .insert({
        client_id: id,
        title,
        description: description || null,
        content_type: content_type || null,
        status: status || 'draft',
        scheduled_date: scheduled_date || null,
        drive_link: drive_link || null,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) { res.status(500).json({ error: error.message }); return; }
    res.status(201).json({ plan: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create content plan' });
  }
});

router.put('/:id/content-plans/:planId', authMiddleware, ownerOrSalesOrTeamLeaderOrAccountManager, async (req: AuthRequest, res: Response): Promise<void> => {
  const { planId } = req.params;
  const { title, description, content_type, status, scheduled_date, drive_link, notes } = req.body;

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description || null;
  if (content_type !== undefined) updates.content_type = content_type || null;
  if (status !== undefined) updates.status = status;
  if (scheduled_date !== undefined) updates.scheduled_date = scheduled_date || null;
  if (drive_link !== undefined) updates.drive_link = drive_link || null;
  if (notes !== undefined) updates.notes = notes || null;

  try {
    const { data, error } = await supabaseAdmin
      .from('client_content_plans')
      .update(updates)
      .eq('id', planId)
      .select()
      .single();

    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ plan: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update content plan' });
  }
});

router.delete('/:id/content-plans/:planId', authMiddleware, ownerOrSalesOrTeamLeaderOrAccountManager, async (req: AuthRequest, res: Response): Promise<void> => {
  const { planId } = req.params;
  try {
    const { error } = await supabaseAdmin.from('client_content_plans').delete().eq('id', planId);
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ message: 'Content plan deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete content plan' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// IDEAS CRUD
// ═══════════════════════════════════════════════════════════════════════════

router.get('/:id/ideas', authMiddleware, ownerOrSalesOrTeamLeaderOrAccountManager, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    const { data, error } = await supabaseAdmin
      .from('client_ideas')
      .select('*')
      .eq('client_id', id)
      .order('created_at', { ascending: false });

    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ ideas: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch ideas' });
  }
});

router.post('/:id/ideas', authMiddleware, ownerOrSalesOrTeamLeaderOrAccountManager, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { title, description, color, status, drive_link, attachment_url, attachment_name } = req.body;

  if (!title) { res.status(400).json({ error: 'Title is required' }); return; }

  try {
    const { data, error } = await supabaseAdmin
      .from('client_ideas')
      .insert({
        client_id: id,
        title,
        description: description || null,
        color: color || '#6366f1',
        status: status || 'idea',
        drive_link: drive_link || null,
        attachment_url: attachment_url || null,
        attachment_name: attachment_name || null,
      })
      .select()
      .single();

    if (error) { res.status(500).json({ error: error.message }); return; }
    res.status(201).json({ idea: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create idea' });
  }
});

router.put('/:id/ideas/:ideaId', authMiddleware, ownerOrSalesOrTeamLeaderOrAccountManager, async (req: AuthRequest, res: Response): Promise<void> => {
  const { ideaId } = req.params;
  const { title, description, color, status, drive_link, attachment_url, attachment_name } = req.body;

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description || null;
  if (color !== undefined) updates.color = color;
  if (status !== undefined) updates.status = status;
  if (drive_link !== undefined) updates.drive_link = drive_link || null;
  if (attachment_url !== undefined) updates.attachment_url = attachment_url || null;
  if (attachment_name !== undefined) updates.attachment_name = attachment_name || null;

  try {
    const { data, error } = await supabaseAdmin
      .from('client_ideas')
      .update(updates)
      .eq('id', ideaId)
      .select()
      .single();

    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ idea: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update idea' });
  }
});

// POST /api/closed-clients/:id/ideas/upload — Upload attachment for idea
router.post('/:id/ideas/upload', authMiddleware, ownerOrSalesOrTeamLeaderOrAccountManager, upload.single('file'), async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!req.file) {
    res.status(400).json({ error: 'No file provided' });
    return;
  }

  try {
    const file = req.file;
    const storagePath = `closed-clients/${id}/ideas/${Date.now()}_${file.originalname}`;

    // Upload to Supabase Storage in attachments bucket
    const { error: uploadError } = await supabaseAdmin.storage
      .from('attachments')
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      res.status(500).json({ error: uploadError.message });
      return;
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('attachments')
      .getPublicUrl(storagePath);

    res.status(201).json({
      public_url: urlData.publicUrl,
      filename: file.originalname,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to upload idea attachment' });
  }
});

router.delete('/:id/ideas/:ideaId', authMiddleware, ownerOrSalesOrTeamLeaderOrAccountManager, async (req: AuthRequest, res: Response): Promise<void> => {
  const { ideaId } = req.params;
  try {
    const { error } = await supabaseAdmin.from('client_ideas').delete().eq('id', ideaId);
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ message: 'Idea deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete idea' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// REPORTS CRUD
// ═══════════════════════════════════════════════════════════════════════════

router.get('/:id/reports', authMiddleware, ownerOrSalesOrTeamLeaderOrAccountManager, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    const { data, error } = await supabaseAdmin
      .from('client_reports')
      .select('*')
      .eq('client_id', id)
      .order('report_month', { ascending: false });

    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ reports: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

router.post('/:id/reports', authMiddleware, ownerOrSalesOrTeamLeaderOrAccountManager, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { report_month, views, interactions, messages, num_posts, num_reels, num_stories, num_photos, notes } = req.body;

  if (!report_month) { res.status(400).json({ error: 'Report month is required' }); return; }

  try {
    const { data, error } = await supabaseAdmin
      .from('client_reports')
      .upsert({
        client_id: id,
        report_month,
        views: views ?? 0,
        interactions: interactions ?? 0,
        messages: messages ?? 0,
        num_posts: num_posts ?? 0,
        num_reels: num_reels ?? 0,
        num_stories: num_stories ?? 0,
        num_photos: num_photos ?? 0,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'client_id,report_month' })
      .select()
      .single();

    if (error) { res.status(500).json({ error: error.message }); return; }
    res.status(201).json({ report: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create report' });
  }
});

router.put('/:id/reports/:reportId', authMiddleware, ownerOrSalesOrTeamLeaderOrAccountManager, async (req: AuthRequest, res: Response): Promise<void> => {
  const { reportId } = req.params;
  const { report_month, views, interactions, messages, num_posts, num_reels, num_stories, num_photos, notes } = req.body;

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (report_month !== undefined) updates.report_month = report_month;
  if (views !== undefined) updates.views = views;
  if (interactions !== undefined) updates.interactions = interactions;
  if (messages !== undefined) updates.messages = messages;
  if (num_posts !== undefined) updates.num_posts = num_posts;
  if (num_reels !== undefined) updates.num_reels = num_reels;
  if (num_stories !== undefined) updates.num_stories = num_stories;
  if (num_photos !== undefined) updates.num_photos = num_photos;
  if (notes !== undefined) updates.notes = notes || null;

  try {
    const { data, error } = await supabaseAdmin
      .from('client_reports')
      .update(updates)
      .eq('id', reportId)
      .select()
      .single();

    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ report: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update report' });
  }
});

router.delete('/:id/reports/:reportId', authMiddleware, ownerOrSalesOrTeamLeaderOrAccountManager, async (req: AuthRequest, res: Response): Promise<void> => {
  const { reportId } = req.params;
  try {
    const { error } = await supabaseAdmin.from('client_reports').delete().eq('id', reportId);
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ message: 'Report deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete report' });
  }
});

export default router;
